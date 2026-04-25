from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


NoveltyLabel = Literal["NOT_FOUND", "SIMILAR_EXISTS", "EXACT_MATCH"]
RunStatus = Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]


class Reference(BaseModel):
    title: str
    url: str
    source: str | None = None
    snippet: str | None = None
    relevance: float | None = None


class NoveltyResult(BaseModel):
    label: NoveltyLabel
    confidence: float = 0.0
    rationale: str = ""
    references: list[Reference] = Field(default_factory=list)
    matched_entities: dict[str, Any] = Field(default_factory=dict)


class ProtocolStep(BaseModel):
    step_number: int
    action: str
    inputs: list[str] = Field(default_factory=list)
    conditions: str | None = None
    expected_output: str | None = None
    safety_notes: str | None = None
    citations: list[str] = Field(default_factory=list)


class ProtocolResult(BaseModel):
    steps: list[ProtocolStep] = Field(default_factory=list)
    critical_parameters: list[str] = Field(default_factory=list)
    control_design: str | None = None
    risk_notes: str | None = None
    citations: list[Reference] = Field(default_factory=list)


class MaterialLineItem(BaseModel):
    name: str
    supplier: str | None = None
    catalog_number: str | None = None
    pack_size: str | None = None
    unit_price: float | None = None
    currency: str = "USD"
    quantity: float | None = None
    notes: str | None = None
    source_url: str | None = None


class MaterialsResult(BaseModel):
    line_items: list[MaterialLineItem] = Field(default_factory=list)
    budget_total: float = 0.0
    currency: str = "USD"
    lead_time_risks: list[str] = Field(default_factory=list)
    substitution_notes: list[str] = Field(default_factory=list)


class TimelinePhase(BaseModel):
    name: str
    duration_days: int
    depends_on: list[str] = Field(default_factory=list)
    parallelizable: bool = False
    notes: str | None = None


class TimelineResult(BaseModel):
    phases: list[TimelinePhase] = Field(default_factory=list)
    critical_path_days: int = 0
    parallelization_notes: str | None = None


class ValidationResult(BaseModel):
    primary_endpoint: str
    secondary_endpoints: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    qa_checks: list[str] = Field(default_factory=list)
    standards_referenced: list[str] = Field(default_factory=list)


class SynthesisResult(BaseModel):
    overall_confidence: float = 0.0
    cross_section_conflicts: list[str] = Field(default_factory=list)
    summary: str = ""


class ExperimentCreateRequest(BaseModel):
    hypothesis: str = Field(min_length=10)
    domain: str | None = None


class ExperimentSummary(BaseModel):
    id: str
    hypothesis: str
    domain: str | None
    status: RunStatus
    error: str | None
    created_at: datetime
    updated_at: datetime


class AgentRunSummary(BaseModel):
    agent_name: str
    status: RunStatus
    output: dict | None = None
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ExperimentPlanResponse(BaseModel):
    id: int
    experiment_id: str
    version: int
    novelty: NoveltyResult | None = None
    protocol: ProtocolResult | None = None
    materials: MaterialsResult | None = None
    timeline: TimelineResult | None = None
    validation: ValidationResult | None = None
    synthesis: SynthesisResult | None = None
    created_at: datetime


class ExperimentDetailResponse(BaseModel):
    experiment: ExperimentSummary
    agent_runs: list[AgentRunSummary] = Field(default_factory=list)
    latest_plan: ExperimentPlanResponse | None = None


class ReviewCreateRequest(BaseModel):
    section: Literal["protocol", "materials", "timeline", "validation", "novelty"]
    rating: int = Field(ge=1, le=5)
    correction: str | None = None
    reviewer: str | None = None


class ReviewResponse(BaseModel):
    id: int
    experiment_id: str
    section: str
    rating: int
    correction: str | None
    reviewer: str | None
    created_at: datetime
