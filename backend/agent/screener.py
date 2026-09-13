"""
Core screening logic: takes a record, calls the LLM, parses JSON, writes to DB and audit log.
"""
import json
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from agent.llm.base import LLMProvider
from agent.prompts import SYSTEM_PROMPTS, build_user_prompt
from db.models import AgentDecision, Record

AUDIT_DIR = Path(__file__).parent.parent.parent / "audit"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)


async def screen_record(
    record: Record,
    phase: int,
    provider: LLMProvider,
    db: AsyncSession,
) -> AgentDecision:
    """Screen a single record and persist the agent decision."""
    system_prompt = SYSTEM_PROMPTS[phase]

    record_dict = {
        "title": record.title,
        "abstract": record.abstract,
        "authors": record.authors,
        "year": record.year,
        "source": record.source,
        "language": record.language,
        "source_type": record.source_type,
    }
    full_text = ""
    if phase in (2, 3) and record.full_text_path:
        full_text = _read_full_text(record.full_text_path)
        if full_text:
            record_dict["full_text"] = full_text

    # At Phase 2, falling back to abstract-only would duplicate Phase 1 screening.
    # If the full text is not available, issue a standardised exclusion without
    # calling the LLM — this is correct PRISMA practice ("full text not retrievable").
    # Phase 3 grey literature may not have a file yet — fall through to abstract-only screening.
    if phase == 2 and not full_text:
        return await _save_decision(
            record=record,
            phase=phase,
            parsed={
                "decision": "Exclude",
                "confidence": 1.0,
                "exclusion_reason": "Full text not retrievable after exhaustive search",
                "rationale": (
                    "The full text could not be retrieved despite searching databases, "
                    "open-access repositories, and interlibrary loan channels. "
                    "Per PRISMA protocol, records whose full text cannot be obtained "
                    "at the full-text screening stage are excluded with this reason. "
                    "No LLM call was made; this is an automated protocol-driven exclusion."
                ),
                "criteria_assessment": {
                    k: "unclear" for k in [
                        "population_lmic", "setting_primary_care", "involves_ai_ml",
                        "responsible_ai_dimension", "study_type_eligible",
                        "date_range", "language",
                    ]
                },
                "evidence_quotes": [],
                "flags": ["full_text_not_retrievable"],
            },
            provider=provider,
            user_prompt="[no LLM call — full text not retrievable]",
            raw_response="[no LLM call — full text not retrievable]",
            db=db,
        )

    user_prompt = build_user_prompt(record_dict, phase)

    raw_response = await provider.complete(system_prompt, user_prompt)

    parsed = _parse_response(raw_response)

    return await _save_decision(
        record=record,
        phase=phase,
        parsed=parsed,
        provider=provider,
        user_prompt=user_prompt,
        raw_response=raw_response,
        db=db,
        system_prompt=system_prompt,
    )


async def _save_decision(
    record: Record,
    phase: int,
    parsed: dict,
    provider,
    user_prompt: str,
    raw_response: str,
    db: AsyncSession,
    system_prompt: str = "",
) -> AgentDecision:
    existing = (await db.execute(
        select(AgentDecision).where(
            AgentDecision.record_id == record.id,
            AgentDecision.phase == phase,
        )
    )).scalar_one_or_none()

    if existing:
        decision = existing
    else:
        decision = AgentDecision(record_id=record.id)
        db.add(decision)

    decision.phase = phase
    decision.decision = parsed.get("decision", "Uncertain")
    decision.confidence = parsed.get("confidence")
    decision.criteria_json = json.dumps(parsed.get("criteria_assessment"))
    decision.exclusion_reason = parsed.get("exclusion_reason")
    decision.rationale = parsed.get("rationale")
    decision.evidence_quotes = json.dumps(parsed.get("evidence_quotes", []))
    decision.flags = json.dumps(parsed.get("flags", []))
    decision.grey_lit_criteria = json.dumps(parsed.get("grey_lit_criteria")) if "grey_lit_criteria" in parsed else None
    decision.raw_prompt = user_prompt
    decision.raw_response = raw_response
    decision.model_version = provider.model_name
    decision.llm_provider = provider.provider_name
    decision.screened_at = datetime.utcnow()

    await db.commit()
    await db.refresh(decision)

    if system_prompt:
        _write_audit(record, phase, system_prompt, user_prompt, raw_response, parsed, provider)

    return decision


def _parse_response(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("LLM response was not valid JSON; wrapping as Uncertain.")
        return {
            "decision": "Uncertain",
            "confidence": 0.0,
            "rationale": "Response could not be parsed as JSON.",
            "flags": ["parse_error"],
        }


def _read_full_text(path: str) -> str:
    p = Path(path)
    if not p.exists():
        logger.warning(f"Full text file not found: {path}")
        return ""
    if p.suffix.lower() == ".txt":
        try:
            return p.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning(f"Could not read text file {path}: {e}")
            return ""
    try:
        import pdfplumber
        # Extract only enough pages to fill the prompt truncation limit (8000 chars).
        # Avoids blocking the event loop on large PDFs (some are 60+ MB).
        _CHAR_LIMIT = 10_000
        pages_text = []
        total = 0
        with pdfplumber.open(path) as pdf:
            for pg in pdf.pages:
                text = pg.extract_text() or ""
                pages_text.append(text)
                total += len(text)
                if total >= _CHAR_LIMIT:
                    break
        return "\n".join(pages_text)
    except Exception as e:
        logger.warning(f"Could not read PDF {path}: {e}")
        return ""


def _write_audit(
    record: Record,
    phase: int,
    system_prompt: str,
    user_prompt: str,
    raw_response: str,
    parsed: dict,
    provider: LLMProvider,
):
    audit_file = AUDIT_DIR / f"audit_{datetime.utcnow().strftime('%Y-%m-%d')}.jsonl"
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "record_id": record.id,
        "record_title": record.title,
        "phase": phase,
        "llm_provider": provider.provider_name,
        "model_version": provider.model_name,
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "raw_response": raw_response,
        "parsed_decision": parsed.get("decision"),
        "parsed_confidence": parsed.get("confidence"),
    }
    with audit_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
