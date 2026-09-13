from datetime import datetime
from sqlalchemy import (
    Boolean, Float, ForeignKey, Integer, Text, DateTime, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


def agent_dec_for(decisions: list, phase: int):
    """Return the AgentDecision for a specific phase from an eagerly-loaded list."""
    return next((d for d in decisions if d.phase == phase), None)


def latest_agent_dec(decisions: list):
    """Return the highest-phase AgentDecision from an eagerly-loaded list."""
    return max(decisions, key=lambda d: d.phase) if decisions else None


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    osf_url: Mapped[str | None] = mapped_column(Text)
    llm_provider: Mapped[str | None] = mapped_column(Text)
    llm_model: Mapped[str | None] = mapped_column(Text)

    records: Mapped[list["Record"]] = relationship("Record", back_populates="review")


class Record(Base):
    __tablename__ = "records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    review_id: Mapped[int] = mapped_column(Integer, ForeignKey("reviews.id"), nullable=False)
    external_id: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    abstract: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str | None] = mapped_column(Text)
    authors: Mapped[str | None] = mapped_column(Text)  # JSON array
    source: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    source_type: Mapped[str | None] = mapped_column(Text)  # database | grey_literature
    phase: Mapped[int | None] = mapped_column(Integer)  # 1 | 2 | 3
    full_text_path: Mapped[str | None] = mapped_column(Text)
    import_batch: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    review: Mapped["Review"] = relationship("Review", back_populates="records")
    human_decision: Mapped["HumanDecision | None"] = relationship(
        "HumanDecision", back_populates="record", uselist=False
    )
    agent_decisions: Mapped[list["AgentDecision"]] = relationship(
        "AgentDecision", back_populates="record"
    )
    resolution: Mapped["Resolution | None"] = relationship(
        "Resolution", back_populates="record", uselist=False
    )
    extraction: Mapped["Extraction | None"] = relationship(
        "Extraction", back_populates="record", uselist=False
    )


class HumanDecision(Base):
    __tablename__ = "human_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(Integer, ForeignKey("records.id"), nullable=False, unique=True)
    phase: Mapped[int] = mapped_column(Integer)
    decision: Mapped[str] = mapped_column(Text)  # Include | Exclude | Uncertain
    exclusion_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    record: Mapped["Record"] = relationship("Record", back_populates="human_decision")


class AgentDecision(Base):
    __tablename__ = "agent_decisions"
    __table_args__ = (UniqueConstraint("record_id", "phase", name="uq_agent_decision_record_phase"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(Integer, ForeignKey("records.id"), nullable=False)
    phase: Mapped[int] = mapped_column(Integer)
    decision: Mapped[str] = mapped_column(Text)  # Include | Exclude | Uncertain
    confidence: Mapped[float | None] = mapped_column(Float)
    criteria_json: Mapped[str | None] = mapped_column(Text)  # JSON
    exclusion_reason: Mapped[str | None] = mapped_column(Text)
    rationale: Mapped[str | None] = mapped_column(Text)
    evidence_quotes: Mapped[str | None] = mapped_column(Text)  # JSON array
    flags: Mapped[str | None] = mapped_column(Text)  # JSON array
    grey_lit_criteria: Mapped[str | None] = mapped_column(Text)  # JSON, phase 3 only
    raw_prompt: Mapped[str | None] = mapped_column(Text)
    raw_response: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(Text)
    llm_provider: Mapped[str | None] = mapped_column(Text)
    screened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    record: Mapped["Record"] = relationship("Record", back_populates="agent_decisions")


class Resolution(Base):
    __tablename__ = "resolutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(Integer, ForeignKey("records.id"), nullable=False, unique=True)
    phase: Mapped[int] = mapped_column(Integer)
    final_decision: Mapped[str] = mapped_column(Text)
    human_original: Mapped[str | None] = mapped_column(Text)
    agent_decision: Mapped[str | None] = mapped_column(Text)
    was_conflict: Mapped[bool] = mapped_column(Boolean, default=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    record: Mapped["Record"] = relationship("Record", back_populates="resolution")


class Extraction(Base):
    __tablename__ = "extractions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(Integer, ForeignKey("records.id"), nullable=False, unique=True)

    # 1. Study characteristics
    study_design: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(Text)
    health_system_level: Mapped[str | None] = mapped_column(Text)

    # 2. AI system characteristics
    ai_system_name: Mapped[str | None] = mapped_column(Text)
    ml_technique: Mapped[str | None] = mapped_column(Text)
    clinical_application: Mapped[str | None] = mapped_column(Text)
    deployment_status: Mapped[str | None] = mapped_column(Text)

    # 3. Primary care setting
    patient_population: Mapped[str | None] = mapped_column(Text)
    clinical_domain: Mapped[str | None] = mapped_column(Text)

    # 4. LMIC context
    infrastructure_context: Mapped[str | None] = mapped_column(Text)
    data_governance_context: Mapped[str | None] = mapped_column(Text)

    # 5. NASSS implementation domains (Greenhalgh et al., 2017) — JSON {rating, detail}
    nasss_condition: Mapped[str | None] = mapped_column(Text)
    nasss_technology: Mapped[str | None] = mapped_column(Text)
    nasss_value_proposition: Mapped[str | None] = mapped_column(Text)
    nasss_adopter_staff: Mapped[str | None] = mapped_column(Text)
    nasss_adopter_patients: Mapped[str | None] = mapped_column(Text)
    nasss_org_context: Mapped[str | None] = mapped_column(Text)
    nasss_institutional: Mapped[str | None] = mapped_column(Text)

    # 6. WHO responsible AI dimensions — each stored as JSON {rating, detail}
    who_transparency: Mapped[str | None] = mapped_column(Text)
    who_accountability: Mapped[str | None] = mapped_column(Text)
    who_inclusiveness: Mapped[str | None] = mapped_column(Text)
    who_non_maleficence: Mapped[str | None] = mapped_column(Text)
    who_autonomy: Mapped[str | None] = mapped_column(Text)
    who_sustainability: Mapped[str | None] = mapped_column(Text)

    # 6. Implementation barriers — JSON string arrays
    barriers_technology: Mapped[str | None] = mapped_column(Text)
    barriers_workforce: Mapped[str | None] = mapped_column(Text)
    barriers_organisational: Mapped[str | None] = mapped_column(Text)
    barriers_equity: Mapped[str | None] = mapped_column(Text)
    barriers_governance: Mapped[str | None] = mapped_column(Text)

    # 7. Implementation enablers — JSON string arrays
    enablers_technology: Mapped[str | None] = mapped_column(Text)
    enablers_workforce: Mapped[str | None] = mapped_column(Text)
    enablers_organisational: Mapped[str | None] = mapped_column(Text)
    enablers_equity: Mapped[str | None] = mapped_column(Text)
    enablers_governance: Mapped[str | None] = mapped_column(Text)

    # 8. Governance & equity notes
    governance_equity_notes: Mapped[str | None] = mapped_column(Text)

    # Metadata
    extractor_notes: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    record: Mapped["Record"] = relationship("Record", back_populates="extraction")
