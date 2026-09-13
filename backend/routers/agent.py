"""
Agent router: trigger batch screening runs, poll job status.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agent.llm.factory import get_llm_provider
from agent.screener import screen_record
from db.database import AsyncSessionLocal, get_db
from db.models import Record, agent_dec_for

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])
DEFAULT_RECORD_TIMEOUT_SECONDS = 120.0

# In-memory job store (sufficient for single-user local app)
_jobs: dict[str, dict] = {}


class RunAgentRequest(BaseModel):
    review_id: int
    phase: int = 1
    sample_ids: Optional[list[int]] = None  # if None, screen all unscreened


class JobStatus(BaseModel):
    job_id: str
    status: str  # queued | running | done | error
    total: int
    completed: int
    errors: int
    started_at: Optional[str]
    finished_at: Optional[str]
    error_message: Optional[str] = None
    current_record_id: Optional[int] = None
    current_record_title: Optional[str] = None


@router.post("/run", status_code=202)
async def run_agent(
    body: RunAgentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Find records to screen
    q = select(Record).where(
        Record.review_id == body.review_id,
        Record.phase == body.phase,
    ).options(selectinload(Record.agent_decisions))

    if body.sample_ids:
        q = q.where(Record.id.in_(body.sample_ids))

    result = await db.execute(q)
    all_records = result.scalars().all()

    force_rescreen = bool(body.sample_ids)
    to_screen = all_records if force_rescreen else [
        r for r in all_records
        if agent_dec_for(r.agent_decisions, body.phase) is None
    ]

    if not to_screen:
        return {"job_id": None, "message": "No records to screen", "total": 0}

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "queued",
        "total": len(to_screen),
        "completed": 0,
        "errors": 0,
        "started_at": None,
        "finished_at": None,
        "error_message": None,
        "current_record_id": None,
        "current_record_title": None,
    }

    record_ids = [r.id for r in to_screen]
    background_tasks.add_task(_run_screening_job, job_id, record_ids, body.phase, force_rescreen)

    return {"job_id": job_id, "total": len(to_screen)}


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(job_id=job_id, **job)


@router.get("/jobs", response_model=list[JobStatus])
async def list_jobs():
    return [JobStatus(job_id=jid, **data) for jid, data in _jobs.items()]


async def _run_screening_job(job_id: str, record_ids: list[int], phase: int, force_rescreen: bool = False):
    _jobs[job_id]["status"] = "running"
    _jobs[job_id]["started_at"] = datetime.utcnow().isoformat()

    total = len(record_ids)
    logger.info(f"[job {job_id[:8]}] Starting phase {phase} screening — {total} records")

    provider = get_llm_provider()
    record_timeout = float(os.getenv("LLM_RECORD_TIMEOUT_SECONDS", DEFAULT_RECORD_TIMEOUT_SECONDS))

    async with AsyncSessionLocal() as db:
        for i, record_id in enumerate(record_ids, start=1):
            try:
                result = await db.execute(
                    select(Record).where(Record.id == record_id).options(
                        selectinload(Record.agent_decisions)
                    )
                )
                record = result.scalar_one_or_none()
                if record and (force_rescreen or agent_dec_for(record.agent_decisions, phase) is None):
                    _jobs[job_id]["current_record_id"] = record.id
                    _jobs[job_id]["current_record_title"] = record.title
                    logger.info(
                        f"[job {job_id[:8]}] [{i}/{total}] screening {record.title[:60]!r}"
                    )
                    decision = await asyncio.wait_for(
                        screen_record(record, phase, provider, db),
                        timeout=record_timeout,
                    )
                    logger.info(
                        f"[job {job_id[:8]}] [{i}/{total}] {record.title[:60]!r} → {decision.decision} "
                        f"(conf {decision.confidence:.2f})"
                    )
                else:
                    logger.info(f"[job {job_id[:8]}] [{i}/{total}] record {record_id} skipped (already screened)")
                _jobs[job_id]["completed"] += 1
                await asyncio.sleep(5)
            except asyncio.TimeoutError:
                await db.rollback()
                _jobs[job_id]["errors"] += 1
                _jobs[job_id]["error_message"] = (
                    f"Record {record_id} timed out after {record_timeout:.0f} seconds"
                )
                logger.error(
                    f"[job {job_id[:8]}] [{i}/{total}] record {record_id} timed out "
                    f"after {record_timeout:.0f} seconds"
                )
            except Exception as e:
                await db.rollback()
                _jobs[job_id]["errors"] += 1
                _jobs[job_id]["error_message"] = str(e)
                logger.error(f"[job {job_id[:8]}] [{i}/{total}] record {record_id} failed: {e}")

    _jobs[job_id]["status"] = "done"
    _jobs[job_id]["current_record_id"] = None
    _jobs[job_id]["current_record_title"] = None
    _jobs[job_id]["finished_at"] = datetime.utcnow().isoformat()
    logger.info(
        f"[job {job_id[:8]}] Done. {_jobs[job_id]['completed']}/{total} completed, "
        f"{_jobs[job_id]['errors']} errors."
    )
