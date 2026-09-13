"""
Extraction router: human data extraction for included records (phases 2 and 3).
"""
import csv
import io
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import Extraction, HumanDecision, Record

router = APIRouter(prefix="/reviews/{review_id}/extraction", tags=["extraction"])


class WhoDimension(BaseModel):
    rating: str | None = None
    detail: str | None = None


class ExtractionIn(BaseModel):
    study_design: str | None = None
    country: str | None = None
    health_system_level: str | None = None
    ai_system_name: str | None = None
    ml_technique: str | None = None
    clinical_application: str | None = None
    deployment_status: str | None = None
    patient_population: str | None = None
    clinical_domain: str | None = None
    infrastructure_context: str | None = None
    data_governance_context: str | None = None
    nasss_condition: WhoDimension | None = None
    nasss_technology: WhoDimension | None = None
    nasss_value_proposition: WhoDimension | None = None
    nasss_adopter_staff: WhoDimension | None = None
    nasss_adopter_patients: WhoDimension | None = None
    nasss_org_context: WhoDimension | None = None
    nasss_institutional: WhoDimension | None = None
    who_transparency: WhoDimension | None = None
    who_accountability: WhoDimension | None = None
    who_inclusiveness: WhoDimension | None = None
    who_non_maleficence: WhoDimension | None = None
    who_autonomy: WhoDimension | None = None
    who_sustainability: WhoDimension | None = None
    barriers_technology: list[str] | None = None
    barriers_workforce: list[str] | None = None
    barriers_organisational: list[str] | None = None
    barriers_equity: list[str] | None = None
    barriers_governance: list[str] | None = None
    enablers_technology: list[str] | None = None
    enablers_workforce: list[str] | None = None
    enablers_organisational: list[str] | None = None
    enablers_equity: list[str] | None = None
    enablers_governance: list[str] | None = None
    governance_equity_notes: str | None = None
    extractor_notes: str | None = None


class ExtractionOut(ExtractionIn):
    id: int
    record_id: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExtractionListItem(BaseModel):
    id: int
    external_id: str | None
    title: str | None
    source_type: str | None
    phase: int | None
    has_full_text: bool
    full_text_is_pdf: bool
    extracted: bool
    study_design: str | None
    country: str | None

    model_config = {"from_attributes": True}


def _who_to_json(dim: WhoDimension | None) -> str | None:
    if dim is None:
        return None
    return json.dumps({"rating": dim.rating, "detail": dim.detail})


def _json_to_who(raw: str | None) -> WhoDimension | None:
    if not raw:
        return None
    try:
        d = json.loads(raw)
        return WhoDimension(rating=d.get("rating"), detail=d.get("detail"))
    except (json.JSONDecodeError, AttributeError):
        return None


def _list_to_json(lst: list[str] | None) -> str | None:
    return json.dumps(lst) if lst is not None else None


def _json_to_list(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


WHO_FIELDS = [
    "nasss_condition", "nasss_technology", "nasss_value_proposition",
    "nasss_adopter_staff", "nasss_adopter_patients", "nasss_org_context",
    "nasss_institutional", "who_transparency", "who_accountability",
    "who_inclusiveness", "who_non_maleficence", "who_autonomy",
    "who_sustainability",
]

LIST_FIELDS = [
    "barriers_technology", "barriers_workforce", "barriers_organisational",
    "barriers_equity", "barriers_governance", "enablers_technology",
    "enablers_workforce", "enablers_organisational", "enablers_equity",
    "enablers_governance",
]

SCALAR_FIELDS = [
    "study_design", "country", "health_system_level", "ai_system_name",
    "ml_technique", "clinical_application", "deployment_status",
    "patient_population", "clinical_domain", "infrastructure_context",
    "data_governance_context", "governance_equity_notes", "extractor_notes",
]


def _extraction_to_out(ex: Extraction) -> dict[str, Any]:
    d: dict[str, Any] = {
        "id": ex.id,
        "record_id": ex.record_id,
        "updated_at": ex.updated_at,
    }
    for field in SCALAR_FIELDS:
        d[field] = getattr(ex, field)
    for field in WHO_FIELDS:
        d[field] = _json_to_who(getattr(ex, field))
    for field in LIST_FIELDS:
        d[field] = _json_to_list(getattr(ex, field))
    return d


def _apply_in(ex: Extraction, data: ExtractionIn):
    for field in SCALAR_FIELDS:
        setattr(ex, field, getattr(data, field))
    for field in WHO_FIELDS:
        setattr(ex, field, _who_to_json(getattr(data, field)))
    for field in LIST_FIELDS:
        setattr(ex, field, _list_to_json(getattr(data, field)))
    ex.updated_at = datetime.utcnow()


async def _get_extractable_records(review_id: int, db: AsyncSession) -> list[Record]:
    p2_q = (
        select(Record)
        .join(HumanDecision, HumanDecision.record_id == Record.id)
        .where(
            Record.review_id == review_id,
            Record.phase == 2,
            HumanDecision.decision == "Include",
        )
        .options(selectinload(Record.extraction))
    )
    p2 = (await db.execute(p2_q)).scalars().all()

    p3_q = (
        select(Record)
        .where(Record.review_id == review_id, Record.phase == 3)
        .options(selectinload(Record.extraction))
    )
    p3 = (await db.execute(p3_q)).scalars().all()

    return list(p2) + list(p3)


@router.get("", response_model=list[ExtractionListItem])
async def list_extractions(review_id: int, db: AsyncSession = Depends(get_db)):
    records = await _get_extractable_records(review_id, db)
    out = []
    for record in records:
        ex = record.extraction
        out.append(ExtractionListItem(
            id=record.id,
            external_id=record.external_id,
            title=record.title,
            source_type=record.source_type,
            phase=record.phase,
            has_full_text=bool(record.full_text_path),
            full_text_is_pdf=bool(
                record.full_text_path and record.full_text_path.lower().endswith(".pdf")
            ),
            extracted=ex is not None,
            study_design=ex.study_design if ex else None,
            country=ex.country if ex else None,
        ))
    return out


@router.get("/export/csv")
async def export_extractions_csv(review_id: int, db: AsyncSession = Depends(get_db)):
    records = await _get_extractable_records(review_id, db)

    headers = [
        "record_id", "external_id", "title", "year", "authors", "source",
        "source_type", "phase", "study_design", "country", "health_system_level",
        "ai_system_name", "ml_technique", "clinical_application", "deployment_status",
        "patient_population", "clinical_domain", "infrastructure_context",
        "data_governance_context", "nasss_condition_rating", "nasss_condition_detail",
        "nasss_technology_rating", "nasss_technology_detail",
        "nasss_value_proposition_rating", "nasss_value_proposition_detail",
        "nasss_adopter_staff_rating", "nasss_adopter_staff_detail",
        "nasss_adopter_patients_rating", "nasss_adopter_patients_detail",
        "nasss_org_context_rating", "nasss_org_context_detail",
        "nasss_institutional_rating", "nasss_institutional_detail",
        "who_transparency_rating", "who_transparency_detail",
        "who_accountability_rating", "who_accountability_detail",
        "who_inclusiveness_rating", "who_inclusiveness_detail",
        "who_non_maleficence_rating", "who_non_maleficence_detail",
        "who_autonomy_rating", "who_autonomy_detail",
        "who_sustainability_rating", "who_sustainability_detail",
        "barriers_technology", "barriers_workforce", "barriers_organisational",
        "barriers_equity", "barriers_governance", "enablers_technology",
        "enablers_workforce", "enablers_organisational", "enablers_equity",
        "enablers_governance", "governance_equity_notes", "extractor_notes",
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)

    for record in records:
        ex = record.extraction
        row = [
            record.id, record.external_id, record.title, record.year,
            record.authors, record.source, record.source_type, record.phase,
        ]
        if ex:
            row += [
                ex.study_design, ex.country, ex.health_system_level,
                ex.ai_system_name, ex.ml_technique, ex.clinical_application,
                ex.deployment_status, ex.patient_population, ex.clinical_domain,
                ex.infrastructure_context, ex.data_governance_context,
            ]
            for field in WHO_FIELDS:
                parsed = _json_to_who(getattr(ex, field))
                row += [parsed.rating if parsed else "", parsed.detail if parsed else ""]
            for field in LIST_FIELDS:
                values = _json_to_list(getattr(ex, field))
                row.append("; ".join(values) if values else "")
            row += [ex.governance_equity_notes, ex.extractor_notes]
        else:
            row += [""] * (len(headers) - len(row))
        writer.writerow(row)

    output.seek(0)
    filename = f"extractions_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{record_id}")
async def get_extraction(review_id: int, record_id: int, db: AsyncSession = Depends(get_db)):
    record = (await db.execute(
        select(Record)
        .where(Record.id == record_id, Record.review_id == review_id)
        .options(selectinload(Record.extraction))
    )).scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Record not found")
    if not record.extraction:
        return None
    return _extraction_to_out(record.extraction)


@router.put("/{record_id}")
async def save_extraction(
    review_id: int,
    record_id: int,
    data: ExtractionIn,
    db: AsyncSession = Depends(get_db),
):
    record = (await db.execute(
        select(Record)
        .where(Record.id == record_id, Record.review_id == review_id)
        .options(selectinload(Record.extraction))
    )).scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Record not found")

    ex = record.extraction
    if not ex:
        ex = Extraction(record_id=record_id)
        db.add(ex)

    _apply_in(ex, data)

    await db.commit()
    await db.refresh(ex)
    return _extraction_to_out(ex)
