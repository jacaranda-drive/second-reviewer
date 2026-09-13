"""
Export router: download screening decisions as CSV.
"""
import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import Record, agent_dec_for

router = APIRouter(prefix="/reviews/{review_id}/export", tags=["export"])


@router.get("/csv")
async def export_csv(
    review_id: int,
    phase: int = 1,
    db: AsyncSession = Depends(get_db),
):
    q = select(Record).where(
        Record.review_id == review_id,
        Record.phase == phase,
    ).options(
        selectinload(Record.human_decision),
        selectinload(Record.agent_decisions),
        selectinload(Record.resolution),
    )
    result = await db.execute(q)
    records = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "record_id", "external_id", "title", "authors", "year", "source",
        "phase", "source_type",
        "human_decision", "human_exclusion_reason", "human_notes",
        "agent_decision", "agent_confidence", "agent_exclusion_reason", "agent_rationale",
        "agent_flags", "agreement", "final_decision", "resolution_notes",
    ])

    for r in records:
        hd = r.human_decision
        ad = agent_dec_for(r.agent_decisions, phase)
        res = r.resolution

        human_dec = hd.decision if (hd and hd.phase == phase) else ""
        agent_dec = ad.decision if ad else ""
        agreement = ("agree" if human_dec == agent_dec else "conflict") if (human_dec and agent_dec) else ""
        flags = json.loads(ad.flags or "[]") if ad else []
        writer.writerow([
            r.id, r.external_id, r.title, r.authors, r.year, r.source,
            r.phase, r.source_type,
            human_dec,
            hd.exclusion_reason if (hd and hd.phase == phase) else "",
            hd.notes if (hd and hd.phase == phase) else "",
            agent_dec,
            ad.confidence if ad else "",
            ad.exclusion_reason if ad else "",
            ad.rationale if ad else "",
            "; ".join(flags),
            agreement,
            res.final_decision if res else "",
            res.resolution_notes if res else "",
        ])

    output.seek(0)
    filename = f"screening_phase{phase}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/conflicts")
async def export_conflicts(
    review_id: int,
    db: AsyncSession = Depends(get_db),
):
    q = select(Record).where(
        Record.review_id == review_id,
        Record.phase == 1,
    ).options(
        selectinload(Record.human_decision),
        selectinload(Record.agent_decisions),
    )
    result = await db.execute(q)
    records = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "record_id", "covidence_id", "title", "authors", "year",
        "human_decision", "human_exclusion_reason",
        "agent_decision", "agent_confidence", "agent_exclusion_reason", "agent_rationale",
    ])

    for r in records:
        hd = r.human_decision
        ad = agent_dec_for(r.agent_decisions, 1)
        if not hd or not ad:
            continue
        # Genuine conflict: both gave definitive decisions and they disagree
        # (excludes agent Uncertain per Option 2)
        if ad.decision == "Uncertain":
            continue
        if hd.decision == ad.decision:
            continue
        writer.writerow([
            r.id, r.external_id, r.title, r.authors, r.year,
            hd.decision, hd.exclusion_reason or "",
            ad.decision, ad.confidence or "", ad.exclusion_reason or "", ad.rationale or "",
        ])

    output.seek(0)
    filename = f"conflicts_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
