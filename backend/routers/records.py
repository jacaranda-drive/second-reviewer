import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import Record, HumanDecision, AgentDecision, Resolution, latest_agent_dec

router = APIRouter(prefix="/reviews/{review_id}/records", tags=["records"])


class HumanDecisionCreate(BaseModel):
    decision: str  # Include | Exclude | Uncertain
    exclusion_reason: Optional[str] = None
    notes: Optional[str] = None
    phase: int = 1


class ResolutionCreate(BaseModel):
    final_decision: str
    resolution_notes: Optional[str] = None


class RecordOut(BaseModel):
    id: int
    review_id: int
    external_id: Optional[str]
    title: Optional[str]
    abstract: Optional[str]
    year: Optional[int]
    language: Optional[str]
    authors: Optional[str]
    source: Optional[str]
    url: Optional[str]
    source_type: Optional[str]
    phase: Optional[int]
    full_text_path: Optional[str]
    import_batch: Optional[str]
    created_at: datetime
    human_decision: Optional[dict] = None
    agent_decision: Optional[dict] = None
    resolution: Optional[dict] = None

    class Config:
        from_attributes = True


def _decision_to_dict(obj) -> Optional[dict]:
    if obj is None:
        return None
    data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for key in ("criteria_json", "evidence_quotes", "flags", "grey_lit_criteria"):
        if key in data and isinstance(data[key], str):
            try:
                data[key] = json.loads(data[key])
            except Exception:
                pass
    return data


@router.get("/", response_model=list[RecordOut])
async def list_records(
    review_id: int,
    phase: Optional[int] = None,
    screened_human: Optional[bool] = None,
    screened_agent: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Record).where(Record.review_id == review_id).options(
        selectinload(Record.human_decision),
        selectinload(Record.agent_decisions),
        selectinload(Record.resolution),
    )
    if phase is not None:
        q = q.where(Record.phase == phase)
    result = await db.execute(q)
    records = result.scalars().all()

    if screened_human is not None:
        records = [r for r in records if (r.human_decision is not None) == screened_human]
    if screened_agent is not None:
        records = [r for r in records if bool(r.agent_decisions) == screened_agent]

    out = []
    for r in records:
        d = RecordOut(
            **{c.name: getattr(r, c.name) for c in r.__table__.columns},
            human_decision=_decision_to_dict(r.human_decision),
            agent_decision=_decision_to_dict(latest_agent_dec(r.agent_decisions)),
            resolution=_decision_to_dict(r.resolution),
        )
        out.append(d)
    return out


@router.get("/{record_id}", response_model=RecordOut)
async def get_record(review_id: int, record_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Record)
        .where(and_(Record.id == record_id, Record.review_id == review_id))
        .options(
            selectinload(Record.human_decision),
            selectinload(Record.agent_decisions),
            selectinload(Record.resolution),
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    d = RecordOut(
        **{c.name: getattr(record, c.name) for c in record.__table__.columns},
        human_decision=_decision_to_dict(record.human_decision),
        agent_decision=_decision_to_dict(latest_agent_dec(record.agent_decisions)),
        resolution=_decision_to_dict(record.resolution),
    )
    return d


@router.post("/{record_id}/human-decision", status_code=200)
async def save_human_decision(
    review_id: int,
    record_id: int,
    body: HumanDecisionCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(HumanDecision).where(HumanDecision.record_id == record_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.decision = body.decision
        existing.exclusion_reason = body.exclusion_reason
        existing.notes = body.notes
        existing.phase = body.phase
        existing.updated_at = datetime.utcnow()
    else:
        existing = HumanDecision(
            record_id=record_id,
            phase=body.phase,
            decision=body.decision,
            exclusion_reason=body.exclusion_reason,
            notes=body.notes,
        )
        db.add(existing)
    await db.commit()
    return {"status": "saved"}


@router.post("/{record_id}/resolution", status_code=200)
async def save_resolution(
    review_id: int,
    record_id: int,
    body: ResolutionCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Record)
        .where(and_(Record.id == record_id, Record.review_id == review_id))
        .options(
            selectinload(Record.human_decision),
            selectinload(Record.agent_decisions),
            selectinload(Record.resolution),
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    human_dec = record.human_decision.decision if record.human_decision else None
    _ad = latest_agent_dec(record.agent_decisions)
    agent_dec = _ad.decision if _ad else None
    was_conflict = human_dec != agent_dec if (human_dec and agent_dec) else False

    existing = record.resolution
    if existing:
        existing.final_decision = body.final_decision
        existing.resolution_notes = body.resolution_notes
        existing.resolved_at = datetime.utcnow()
    else:
        existing = Resolution(
            record_id=record_id,
            phase=record.phase or 1,
            final_decision=body.final_decision,
            human_original=human_dec,
            agent_decision=agent_dec,
            was_conflict=was_conflict,
            resolution_notes=body.resolution_notes,
        )
        db.add(existing)
    await db.commit()
    return {"status": "saved"}


@router.post("/import/ris", status_code=201)
async def import_ris(
    review_id: int,
    phase: int = Form(1),
    source_type: str = Form("database"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    from parsers.ris_parser import parse_ris_bytes
    content = await file.read()
    records_data = parse_ris_bytes(content)
    batch = f"ris_{datetime.utcnow().strftime('%Y-%m-%d_%H%M%S')}"
    created = 0
    for rd in records_data:
        record = Record(
            review_id=review_id,
            external_id=rd.get("external_id"),
            title=rd.get("title"),
            abstract=rd.get("abstract"),
            year=rd.get("year"),
            language=rd.get("language"),
            authors=json.dumps(rd.get("authors", [])),
            source=rd.get("source"),
            url=rd.get("url"),
            source_type=source_type,
            phase=phase,
            import_batch=batch,
        )
        db.add(record)
        created += 1
    await db.commit()
    return {"imported": created, "batch": batch}


@router.post("/import/csv", status_code=201)
async def import_csv(
    review_id: int,
    phase: int = Form(1),
    source_type: str = Form("database"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    from parsers.csv_parser import parse_csv_bytes
    content = await file.read()
    records_data = parse_csv_bytes(content)
    batch = f"csv_{datetime.utcnow().strftime('%Y-%m-%d_%H%M%S')}"
    created = 0
    decisions_imported = 0
    for rd in records_data:
        record = Record(
            review_id=review_id,
            external_id=rd.get("external_id"),
            title=rd.get("title"),
            abstract=rd.get("abstract"),
            year=rd.get("year"),
            language=rd.get("language"),
            authors=json.dumps(rd.get("authors", [])),
            source=rd.get("source"),
            url=rd.get("url"),
            source_type=source_type,
            phase=phase,
            import_batch=batch,
        )
        db.add(record)
        await db.flush()
        if rd.get("decision"):
            db.add(HumanDecision(
                record_id=record.id,
                phase=phase,
                decision=rd["decision"],
                exclusion_reason=rd.get("exclusion_reason"),
                notes=rd.get("notes"),
            ))
            decisions_imported += 1
        created += 1
    await db.commit()
    return {"imported": created, "decisions_imported": decisions_imported, "batch": batch}
