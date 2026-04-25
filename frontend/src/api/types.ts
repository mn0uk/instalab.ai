export type RunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
export type NoveltyLabel = "NOT_FOUND" | "SIMILAR_EXISTS" | "EXACT_MATCH";

export interface Reference {
  title: string;
  url: string;
  source?: string | null;
  snippet?: string | null;
  relevance?: number | null;
}

export interface MatchedEntities {
  intervention: string;
  control: string;
  endpoint: string;
  model_or_system: string;
}

export interface NoveltyResult {
  label: NoveltyLabel;
  confidence: number;
  rationale: string;
  references: Reference[];
  matched_entities: MatchedEntities;
}

export interface ProtocolStep {
  step_number: number;
  action: string;
  inputs: string[];
  conditions?: string | null;
  expected_output?: string | null;
  safety_notes?: string | null;
  citations: string[];
}

export interface ProtocolResult {
  steps: ProtocolStep[];
  critical_parameters: string[];
  control_design?: string | null;
  risk_notes?: string | null;
  citations: Reference[];
}

export interface MaterialLineItem {
  name: string;
  supplier?: string | null;
  catalog_number?: string | null;
  pack_size?: string | null;
  unit_price?: number | null;
  currency: string;
  quantity?: number | null;
  notes?: string | null;
  source_url?: string | null;
}

export interface MaterialsResult {
  line_items: MaterialLineItem[];
  budget_total: number;
  currency: string;
  lead_time_risks: string[];
  substitution_notes: string[];
}

export interface TimelinePhase {
  name: string;
  duration_days: number;
  depends_on: string[];
  parallelizable: boolean;
  notes?: string | null;
}

export interface TimelineResult {
  phases: TimelinePhase[];
  critical_path_days: number;
  parallelization_notes?: string | null;
}

export interface ValidationResult {
  primary_endpoint: string;
  secondary_endpoints: string[];
  acceptance_criteria: string[];
  qa_checks: string[];
  standards_referenced: string[];
}

export interface SynthesisResult {
  overall_confidence: number;
  cross_section_conflicts: string[];
  summary: string;
}

export interface ExperimentSummary {
  id: string;
  hypothesis: string;
  domain?: string | null;
  status: RunStatus;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunSummary {
  agent_name: string;
  status: RunStatus;
  output?: Record<string, unknown> | null;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface ExperimentPlanResponse {
  id: number;
  experiment_id: string;
  version: number;
  novelty?: NoveltyResult | null;
  protocol?: ProtocolResult | null;
  materials?: MaterialsResult | null;
  timeline?: TimelineResult | null;
  validation?: ValidationResult | null;
  synthesis?: SynthesisResult | null;
  created_at: string;
}

export interface ExperimentDetailResponse {
  experiment: ExperimentSummary;
  agent_runs: AgentRunSummary[];
  latest_plan?: ExperimentPlanResponse | null;
}

export interface ReviewCreateRequest {
  section: "protocol" | "materials" | "timeline" | "validation" | "novelty";
  rating: number;
  correction?: string | null;
  reviewer?: string | null;
}

export interface ReviewResponse {
  id: number;
  experiment_id: string;
  section: string;
  rating: number;
  correction?: string | null;
  reviewer?: string | null;
  created_at: string;
}
