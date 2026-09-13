"""
IRR (Inter-Rater Reliability) calculations endpoint.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import Record, agent_dec_for

router = APIRouter(prefix="/reviews/{review_id}/irr", tags=["irr"])

DECISION_LABELS = ["Include", "Exclude", "Uncertain"]


def _phase1_pairs(records: list) -> list[dict]:
    """
    Build Phase 1 (T/A) IRR pairs from an already-loaded record list.

    Two sources of Phase 1 pairs:
    1. Records still at phase 1 with human_decision.phase==1 and a phase-1
       agent decision — the normal case for excluded records.
    2. Records promoted to phase 2+ that have a phase-1 agent decision.
       The T/A agent decision survives because the schema now stores one row
       per (record_id, phase). The human T/A decision was definitionally
       "Include" (only Include records are promoted), but the human_decision
       row may since have been overwritten by a phase-2 full-text decision,
       so we infer "Include" rather than reading the field.
    """
    pairs = []
    for r in records:
        ad = agent_dec_for(r.agent_decisions, 1)
        if ad is None:
            continue
        if r.human_decision is not None and r.human_decision.phase == 1:
            hdec = r.human_decision.decision
        elif r.phase is not None and r.phase >= 2:
            hdec = "Include"
        else:
            continue
        pairs.append({
            "record_id": r.id,
            "title": r.title,
            "human": hdec,
            "agent": ad.decision,
            "agent_confidence": ad.confidence,
            "has_resolution": r.resolution is not None,
        })
    return pairs


def _standard_pairs(records: list, phase: Optional[int]) -> list[dict]:
    """
    Build IRR pairs for phase 2+ (or all-phases when phase is None).
    Both human and agent decisions must carry the requested phase.
    """
    pairs = []
    for r in records:
        if r.human_decision is None:
            continue
        if phase is not None:
            ad = agent_dec_for(r.agent_decisions, phase)
            if ad is None or r.human_decision.phase != phase:
                continue
        else:
            ad = max(r.agent_decisions, key=lambda d: d.phase) if r.agent_decisions else None
            if ad is None:
                continue
        pairs.append({
            "record_id": r.id,
            "title": r.title,
            "human": r.human_decision.decision,
            "agent": ad.decision,
            "agent_confidence": ad.confidence,
            "has_resolution": r.resolution is not None,
        })
    return pairs


def _build_pairs(records: list, phase: Optional[int]) -> list[dict]:
    if phase == 1:
        return _phase1_pairs(records)
    return _standard_pairs(records, phase)


@router.get("/")
async def get_irr(
    review_id: int,
    phase: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Record).where(Record.review_id == review_id).options(
        selectinload(Record.human_decision),
        selectinload(Record.agent_decisions),
        selectinload(Record.resolution),
    )
    result = await db.execute(q)
    records = result.scalars().all()

    all_pairs = _build_pairs(records, phase)
    n_paired = len(all_pairs)

    uncertain_pairs = [p for p in all_pairs if p["agent"] == "Uncertain"]
    for_kappa = [p for p in all_pairs if p["agent"] != "Uncertain"]

    if len(for_kappa) < 2:
        return {
            "kappa": None,
            "kappa_2cat": None,
            "percent_agreement": None,
            "n_paired": n_paired,
            "n_for_kappa": len(for_kappa),
            "n_agent_uncertain": len(uncertain_pairs),
            "confusion_matrix": None,
            "conflicts": [],
            "message": "Not enough paired decisions (excluding agent Uncertain) to calculate kappa (need ≥ 2).",
        }

    human_labels = [p["human"] for p in for_kappa]
    agent_labels = [p["agent"] for p in for_kappa]

    kappa = _cohen_kappa(human_labels, agent_labels, ["Include", "Exclude"])

    h2 = ["Include" if d == "Include" else "Not-Include" for d in human_labels]
    a2 = ["Include" if d == "Include" else "Not-Include" for d in agent_labels]
    kappa_2cat = _cohen_kappa(h2, a2, ["Include", "Not-Include"])

    agreement = sum(h == a for h, a in zip(human_labels, agent_labels)) / len(for_kappa)
    confusion = _confusion_matrix(human_labels, agent_labels)

    conflicts = [
        {
            "record_id": p["record_id"],
            "title": p["title"],
            "human": p["human"],
            "agent": p["agent"],
            "agent_confidence": p["agent_confidence"],
        }
        for p in for_kappa
        if p["human"] != p["agent"]
    ]

    return {
        "kappa": round(kappa, 4),
        "kappa_2cat": round(kappa_2cat, 4),
        "kappa_interpretation": _interpret_kappa(kappa),
        "percent_agreement": round(agreement * 100, 1),
        "n_paired": n_paired,
        "n_for_kappa": len(for_kappa),
        "n_agent_uncertain": len(uncertain_pairs),
        "n_conflicts": len(conflicts),
        "confusion_matrix": confusion,
        "conflicts": conflicts,
        "below_threshold": kappa < 0.61,
    }


@router.get("/summary")
async def get_irr_summary(review_id: int, db: AsyncSession = Depends(get_db)):
    """Per-phase summary for the dashboard."""
    q = select(Record).where(Record.review_id == review_id).options(
        selectinload(Record.human_decision),
        selectinload(Record.agent_decisions),
        selectinload(Record.resolution),
    )
    result = await db.execute(q)
    all_records = result.scalars().all()

    summaries = []
    for phase in [1, 2, 3]:
        pairs = _build_pairs(all_records, phase)

        if phase == 1:
            # total = all records that went through T/A (either still at phase 1,
            # or promoted — their agent_decision.phase==1 marks them as T/A-screened)
            total_ids = {
                r.id for r in all_records
                if r.phase == 1
                or (agent_dec_for(r.agent_decisions, 1) is not None)
                or (r.human_decision and r.human_decision.phase == 1)
            }
            total = len(total_ids)
            # human_done: records with explicit phase-1 human decisions + promoted records
            # (whose T/A human decision was "Include" by definition)
            human_done_ids = {
                r.id for r in all_records
                if (r.human_decision and r.human_decision.phase == 1)
                or (r.phase is not None and r.phase >= 2
                    and agent_dec_for(r.agent_decisions, 1) is not None)
            }
            human_done = len(human_done_ids)
            agent_done = sum(
                1 for r in all_records
                if agent_dec_for(r.agent_decisions, 1) is not None
            )
        else:
            total = sum(1 for r in all_records if r.phase == phase)
            human_done = sum(
                1 for r in all_records
                if r.human_decision and r.human_decision.phase == phase
            )
            agent_done = sum(
                1 for r in all_records
                if agent_dec_for(r.agent_decisions, phase) is not None
            )

        agent_uncertain = sum(1 for p in pairs if p["agent"] == "Uncertain")
        conflicts_unresolved = sum(
            1 for p in pairs
            if p["agent"] != "Uncertain"
            and p["human"] != p["agent"]
            and not p["has_resolution"]
        )
        summaries.append({
            "phase": phase,
            "total": total,
            "human_done": human_done,
            "agent_done": agent_done,
            "n_paired": len(pairs),
            "agent_uncertain": agent_uncertain,
            "conflicts_unresolved": conflicts_unresolved,
        })
    return summaries


def _cohen_kappa(y1: list[str], y2: list[str], labels: list[str]) -> float:
    from sklearn.metrics import cohen_kappa_score
    return float(cohen_kappa_score(y1, y2, labels=labels))


def _interpret_kappa(k: float) -> str:
    if k < 0:
        return "Poor (less than chance)"
    if k < 0.21:
        return "Slight agreement"
    if k < 0.41:
        return "Fair agreement"
    if k < 0.61:
        return "Moderate agreement"
    if k < 0.81:
        return "Substantial agreement"
    return "Almost perfect agreement"


def _confusion_matrix(human: list[str], agent: list[str]) -> dict:
    matrix = {h: {a: 0 for a in DECISION_LABELS} for h in DECISION_LABELS}
    for h, a in zip(human, agent):
        if h in matrix and a in matrix[h]:
            matrix[h][a] += 1
    return matrix
