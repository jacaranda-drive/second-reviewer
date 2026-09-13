"""
Full-text screening management: promote Phase 1 includes to Phase 2,
link Zotero PDFs, serve PDF files.
"""
import csv
import html
import io
import logging
import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import Record, Resolution, HumanDecision, agent_dec_for

router = APIRouter(prefix="/reviews/{review_id}/fulltext", tags=["fulltext"])
logger = logging.getLogger(__name__)
FULLTEXT_STORAGE = Path(__file__).resolve().parents[1] / "data" / "fulltext"


def _effective_decision(record: Record) -> Optional[str]:
    if record.resolution:
        return record.resolution.final_decision
    if record.human_decision:
        return record.human_decision.decision
    return None


def _first_present(row: dict[str, str], keys: list[str]) -> str:
    for key in keys:
        value = row.get(key, "")
        if value:
            return value
    return ""


def _extract_covidence_id(*values: str) -> Optional[str]:
    for value in values:
        text = html.unescape(value or "")
        match = re.search(r"Covidence:\s*#?\s*(\d+)", text, flags=re.IGNORECASE)
        if match:
            return f"#{match.group(1)}"
    return None


def _extract_pdf_path(attachments: str) -> Optional[str]:
    for attachment in (attachments or "").split(";"):
        attachment = attachment.strip()
        if attachment.lower().endswith(".pdf"):
            return attachment
    return None


def _safe_pdf_name(filename: str) -> str:
    stem = Path(filename).stem or "manual-upload"
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._-")
    return f"{safe_stem or 'manual-upload'}_{uuid.uuid4().hex[:8]}.pdf"


@router.post("/promote")
async def promote_to_phase2(review_id: int, db: AsyncSession = Depends(get_db)):
    """Promote all Phase 1 Include records to Phase 2."""
    result = await db.execute(
        select(Record)
        .where(Record.review_id == review_id, Record.phase == 1)
        .options(
            selectinload(Record.human_decision),
            selectinload(Record.resolution),
        )
    )
    records = result.scalars().all()

    promoted = []
    for r in records:
        if _effective_decision(r) == "Include":
            r.phase = 2
            promoted.append(r.id)

    await db.commit()
    logger.info(f"Promoted {len(promoted)} records to Phase 2 for review {review_id}")
    return {"promoted": len(promoted), "record_ids": promoted}


@router.post("/link-zotero")
async def link_zotero_pdfs(
    review_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a Zotero CSV export and link PDF paths to Phase 2 records by Covidence number.
    The CSV must have an 'Extra' column (containing 'Covidence: #N') and a
    'File Attachments' column with the local PDF path.
    """
    content = await file.read()
    text = content.decode("utf-8-sig")  # handle BOM from Windows Excel/Zotero
    reader = csv.DictReader(io.StringIO(text))

    pdf_map: dict[str, str] = {}
    for row in reader:
        extra = _first_present(row, ["Extra", "extra"])
        notes = _first_present(row, ["Notes", "Note", "notes"])
        attachments = _first_present(
            row,
            ["File Attachments", "File Attachment", "Attachments", "files"],
        )
        covidence_id = _extract_covidence_id(extra, notes)
        pdf_path = _extract_pdf_path(attachments)
        if covidence_id and pdf_path:
            pdf_map[covidence_id] = pdf_path

    if not pdf_map:
        raise HTTPException(
            status_code=400,
            detail=(
                "No Covidence IDs with PDF paths found. Check that the Zotero CSV has "
                "'Notes' or 'Extra' values like 'Covidence: #10' and a 'File Attachments' column."
            ),
        )

    result = await db.execute(
        select(Record).where(Record.review_id == review_id, Record.phase == 2)
    )
    records = result.scalars().all()

    linked, missing, file_missing = 0, [], []
    for r in records:
        ext_id = r.external_id
        if ext_id and ext_id in pdf_map:
            path = pdf_map[ext_id]
            if Path(path).exists():
                r.full_text_path = path
                linked += 1
            else:
                file_missing.append({"external_id": ext_id, "path": path})
        else:
            missing.append(ext_id)

    await db.commit()
    logger.info(f"Linked {linked} PDFs for review {review_id}")
    return {
        "linked": linked,
        "total_phase2": len(records),
        "not_in_csv": missing,
        "file_missing": file_missing,
    }


@router.get("/status")
async def phase2_status(review_id: int, db: AsyncSession = Depends(get_db)):
    """Return Phase 2 records with PDF link status and screening progress."""
    result = await db.execute(
        select(Record)
        .where(Record.review_id == review_id, Record.phase == 2)
        .options(
            selectinload(Record.human_decision),
            selectinload(Record.agent_decisions),
        )
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "external_id": r.external_id,
            "title": r.title,
            "has_pdf": bool(r.full_text_path),
            "human_decision": r.human_decision.decision if r.human_decision else None,
            "agent_decision": agent_dec_for(r.agent_decisions, 2).decision if agent_dec_for(r.agent_decisions, 2) else None,
            "agent_phase": agent_dec_for(r.agent_decisions, 2).phase if agent_dec_for(r.agent_decisions, 2) else None,
            "human_decision_phase2": r.human_decision.decision if r.human_decision and r.human_decision.phase == 2 else None,
        }
        for r in records
    ]


@router.post("/{record_id}/pdf")
async def upload_pdf(
    review_id: int,
    record_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload and link a single PDF for a Phase 2 record."""
    result = await db.execute(
        select(Record).where(
            Record.id == record_id,
            Record.review_id == review_id,
            Record.phase == 2,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Phase 2 record not found")

    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded PDF was empty.")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Uploaded file does not look like a valid PDF.")

    upload_dir = FULLTEXT_STORAGE / f"review_{review_id}"
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / f"record_{record_id}_{_safe_pdf_name(filename)}"
    path.write_bytes(content)

    record.full_text_path = str(path)
    await db.commit()
    logger.info(f"Linked manual PDF for review {review_id}, record {record_id}: {path}")
    return {"record_id": record_id, "path": str(path)}


@router.get("/{record_id}/pdf")
async def serve_pdf(review_id: int, record_id: int, db: AsyncSession = Depends(get_db)):
    """Serve the linked PDF file for a record."""
    result = await db.execute(
        select(Record).where(Record.id == record_id, Record.review_id == review_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if not record.full_text_path:
        raise HTTPException(status_code=404, detail="No PDF linked for this record")
    path = Path(record.full_text_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"PDF file not found: {record.full_text_path}")
    return FileResponse(
        str(path),
        media_type="application/pdf",
        filename=path.name,
        content_disposition_type="inline",
    )


@router.get("/{record_id}/content")
async def serve_content(review_id: int, record_id: int, db: AsyncSession = Depends(get_db)):
    """Serve any linked full-text file — PDF or plain text (.txt). Both render inline in an iframe."""
    result = await db.execute(
        select(Record).where(Record.id == record_id, Record.review_id == review_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if not record.full_text_path:
        raise HTTPException(status_code=404, detail="No file linked for this record")
    path = Path(record.full_text_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {record.full_text_path}")
    if path.suffix.lower() == ".txt":
        return FileResponse(str(path), media_type="text/plain; charset=utf-8", content_disposition_type="inline")
    return FileResponse(str(path), media_type="application/pdf", filename=path.name, content_disposition_type="inline")
