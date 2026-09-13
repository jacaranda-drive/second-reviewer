from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Record, HumanDecision, AgentDecision

router = APIRouter(prefix="/reviews/{review_id}/prisma", tags=["prisma"])


@router.get("/stats")
async def get_prisma_stats(
    review_id: int,
    records_identified: int = 0,
    duplicates_removed: int = 0,
    db: AsyncSession = Depends(get_db),
):
    async def count(model, *conditions):
        q = select(func.count()).select_from(model)
        for c in conditions:
            q = q.where(c)
        return (await db.execute(q)).scalar() or 0

    # Phase 1 counts
    # p1_total = all records in the review (all enter T/A; some are later promoted
    # to phase 2, but they still count as part of the T/A pool)
    p1_total = await count(Record, Record.review_id == review_id)
    p1_only = await count(Record, Record.review_id == review_id, Record.phase == 1)

    # Phase 2 total needed before h1_include
    p2_total = await count(Record, Record.review_id == review_id, Record.phase == 2)

    # T/A Human Include = records promoted to phase 2.
    # All promoted records were effectively included at T/A (the promote endpoint
    # uses _effective_decision which respects conflict resolutions). Records where
    # the human said Include but a conflict was resolved as Exclude are NOT promoted
    # and correctly count as T/A excludes here.
    h1_include = p2_total
    h1_exclude = await count(HumanDecision, HumanDecision.phase == 1,
                             HumanDecision.decision == "Exclude",
                             HumanDecision.record_id.in_(
                                 select(Record.id).where(Record.review_id == review_id)))
    h1_uncertain = await count(HumanDecision, HumanDecision.phase == 1,
                               HumanDecision.decision == "Uncertain",
                               HumanDecision.record_id.in_(
                                   select(Record.id).where(Record.review_id == review_id)))
    a1_include = await count(AgentDecision, AgentDecision.phase == 1,
                             AgentDecision.decision == "Include",
                             AgentDecision.record_id.in_(
                                 select(Record.id).where(Record.review_id == review_id)))
    a1_exclude = await count(AgentDecision, AgentDecision.phase == 1,
                             AgentDecision.decision == "Exclude",
                             AgentDecision.record_id.in_(
                                 select(Record.id).where(Record.review_id == review_id)))
    a1_uncertain = await count(AgentDecision, AgentDecision.phase == 1,
                               AgentDecision.decision == "Uncertain",
                               AgentDecision.record_id.in_(
                                   select(Record.id).where(Record.review_id == review_id)))

    # Exclusion reason breakdown (human)
    rr = await db.execute(
        select(HumanDecision.exclusion_reason, func.count())
        .where(
            HumanDecision.phase == 1,
            HumanDecision.decision == "Exclude",
            HumanDecision.record_id.in_(
                select(Record.id).where(Record.review_id == review_id)),
        )
        .group_by(HumanDecision.exclusion_reason)
    )
    exclusion_reasons = {row[0] or "Other": row[1] for row in rr.fetchall()}

    # Phase 2 counts (p2_total already computed above)
    h2_include = await count(HumanDecision, HumanDecision.phase == 2,
                             HumanDecision.decision == "Include",
                             HumanDecision.record_id.in_(
                                 select(Record.id).where(Record.review_id == review_id)))
    h2_exclude = await count(HumanDecision, HumanDecision.phase == 2,
                             HumanDecision.decision == "Exclude",
                             HumanDecision.record_id.in_(
                                 select(Record.id).where(Record.review_id == review_id)))

    imported = records_identified or (p1_total + duplicates_removed)
    deduped = p1_total

    return {
        "records_identified": records_identified,
        "imported": imported,
        "duplicates_removed": duplicates_removed,
        "deduped": deduped,
        "phase1": {
            "total": p1_only,
            "human_include": h1_include,
            "human_exclude": h1_exclude,
            "human_uncertain": h1_uncertain,
            "human_screened": h1_include + h1_exclude + h1_uncertain,
            "agent_include": a1_include,
            "agent_exclude": a1_exclude,
            "agent_uncertain": a1_uncertain,
            "agent_screened": a1_include + a1_exclude + a1_uncertain,
            "exclusion_reasons": exclusion_reasons,
        },
        "phase2": {
            "total": p2_total,
            "human_include": h2_include,
            "human_exclude": h2_exclude,
        },
    }
