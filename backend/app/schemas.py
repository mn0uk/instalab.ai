from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


NoveltyLabel = Literal["NOT_FOUND", "SIMILAR_EXISTS", "EXACT_MATCH"]
RunStatus = Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]


PaperStance = Literal["support", "contradict", "neutral"]
VerificationState = Literal["tested", "assumed", "scope"]


class Reference(BaseModel):
    title: str
    url: str
    source: str | None = None
    snippet: str | None = None
    relevance: float | None = None
    stance: PaperStance | None = None
    author: str | None = None
    organism: str | None = None
    citations: int | None = None


class MatchedEntities(BaseModel):
    """Concrete shape for novelty entity extraction.

    OpenAI's strict structured-output mode rejects open-ended `dict[str, Any]`
    fields (they map to `additionalProperties: true`), so we expose a fixed
    set of fields the LLM is asked to fill. Empty string means "not determined".
    """

    intervention: str = ""
    control: str = ""
    endpoint: str = ""
    model_or_system: str = ""


class VerificationNode(BaseModel):
    """A single claim in the hypothesis verification graph (≤6 per result)."""

    label: str
    state: VerificationState
    note: str = ""


class NoveltyResult(BaseModel):
    label: NoveltyLabel
    confidence: float = 0.0
    rationale: str = ""
    references: list[Reference] = Field(default_factory=list)
    matched_entities: MatchedEntities = Field(default_factory=MatchedEntities)
    verification_nodes: list[VerificationNode] = Field(default_factory=list)


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


MaterialCategory = Literal[
    "bio",
    "reagents",
    "equipment",
    "consumables",
    "controls",
    "safety",
]


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
    category: MaterialCategory | None = None
    options: list[str] = Field(default_factory=list)
    selected: bool = True


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
    owner: str | None = None
    status: str | None = None
    detail: str | None = None
    start_day: int | None = None
    end_day: int | None = None


class Milestone(BaseModel):
    """A point-in-time marker rendered as a diamond on the Gantt chart."""

    day: int
    label: str


class TimelineResult(BaseModel):
    phases: list[TimelinePhase] = Field(default_factory=list)
    critical_path_days: int = 0
    parallelization_notes: str | None = None
    milestones: list[Milestone] = Field(default_factory=list)


class ValidationResult(BaseModel):
    primary_endpoint: str
    secondary_endpoints: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    qa_checks: list[str] = Field(default_factory=list)
    standards_referenced: list[str] = Field(default_factory=list)


class ConflictItem(BaseModel):
    """Structured conflict surfaced in the Summary view's 3-cell grid."""

    title: str
    detail: str = ""


class SynthesisResult(BaseModel):
    overall_confidence: float = 0.0
    cross_section_conflicts: list[str] = Field(default_factory=list)
    conflicts: list[ConflictItem] = Field(default_factory=list)
    summary: str = ""


class ExperimentCreateRequest(BaseModel):
    hypothesis: str = Field(min_length=10)
    domain: str | None = None


class ExperimentPatchRequest(BaseModel):
    hypothesis: str | None = Field(default=None, min_length=10)
    domain: str | None = None


class RegenerateRequest(BaseModel):
    """Optional context passed to the agent pipeline on regenerate."""

    notes: str | None = None
    include_review_corrections: bool = False


class PlanPatchRequest(BaseModel):
    """Partial update merged into the latest experiment plan JSON fields."""

    novelty: dict | None = None
    protocol: dict | None = None
    materials: dict | None = None
    timeline: dict | None = None
    validation: dict | None = None
    synthesis: dict | None = None


class ExperimentSummary(BaseModel):
    id: str
    hypothesis: str
    domain: str | None
    status: RunStatus
    error: str | None
    created_at: datetime
    updated_at: datetime
    novelty_score: int | None = None


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
