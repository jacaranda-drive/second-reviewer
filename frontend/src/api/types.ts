export type Decision = 'Include' | 'Exclude' | 'Uncertain'

export interface Review {
  id: number
  name: string
  description: string | null
  created_at: string
  osf_url: string | null
  llm_provider: string | null
  llm_model: string | null
}

export interface HumanDecision {
  id: number
  record_id: number
  phase: number
  decision: Decision
  exclusion_reason: string | null
  notes: string | null
  decided_at: string
  updated_at: string
}

export interface AgentDecision {
  id: number
  record_id: number
  phase: number
  decision: Decision
  confidence: number | null
  criteria_json: globalThis.Record<string, string> | null
  exclusion_reason: string | null
  rationale: string | null
  evidence_quotes: string[]
  flags: string[]
  grey_lit_criteria: globalThis.Record<string, string> | null
  model_version: string | null
  llm_provider: string | null
  screened_at: string
}

export interface Resolution {
  id: number
  record_id: number
  phase: number
  final_decision: Decision
  human_original: string | null
  agent_decision: string | null
  was_conflict: boolean
  resolution_notes: string | null
  resolved_at: string
}

export interface Record {
  id: number
  review_id: number
  external_id: string | null
  title: string | null
  abstract: string | null
  year: number | null
  language: string | null
  authors: string | null
  source: string | null
  url: string | null
  source_type: string | null
  phase: number | null
  full_text_path: string | null
  import_batch: string | null
  created_at: string
  human_decision: HumanDecision | null
  agent_decision: AgentDecision | null
  resolution: Resolution | null
}

export interface PhaseSummary {
  phase: number
  total: number
  human_done: number
  agent_done: number
  n_paired: number
  conflicts_unresolved: number
}

export interface IRRResult {
  kappa: number | null
  kappa_interpretation: string | null
  percent_agreement: number | null
  n_paired: number
  n_conflicts: number
  confusion_matrix: globalThis.Record<string, globalThis.Record<string, number>> | null
  conflicts: Array<{
    record_id: number
    title: string | null
    human: string
    agent: string
    agent_confidence: number | null
  }>
  below_threshold: boolean
}

export interface WhoDimension {
  rating: 'Yes' | 'Partial' | 'No' | null
  detail: string | null
}

export interface ExtractionListItem {
  id: number
  external_id: string | null
  title: string | null
  source_type: string | null
  phase: number | null
  has_full_text: boolean
  full_text_is_pdf: boolean
  extracted: boolean
  study_design: string | null
  country: string | null
}

export interface Extraction {
  id: number
  record_id: number
  updated_at: string
  study_design: string | null
  country: string | null
  health_system_level: string | null
  ai_system_name: string | null
  ml_technique: string | null
  clinical_application: string | null
  deployment_status: string | null
  patient_population: string | null
  clinical_domain: string | null
  infrastructure_context: string | null
  data_governance_context: string | null
  nasss_condition: WhoDimension | null
  nasss_technology: WhoDimension | null
  nasss_value_proposition: WhoDimension | null
  nasss_adopter_staff: WhoDimension | null
  nasss_adopter_patients: WhoDimension | null
  nasss_org_context: WhoDimension | null
  nasss_institutional: WhoDimension | null
  who_transparency: WhoDimension | null
  who_accountability: WhoDimension | null
  who_inclusiveness: WhoDimension | null
  who_non_maleficence: WhoDimension | null
  who_autonomy: WhoDimension | null
  who_sustainability: WhoDimension | null
  barriers_technology: string[] | null
  barriers_workforce: string[] | null
  barriers_organisational: string[] | null
  barriers_equity: string[] | null
  barriers_governance: string[] | null
  enablers_technology: string[] | null
  enablers_workforce: string[] | null
  enablers_organisational: string[] | null
  enablers_equity: string[] | null
  enablers_governance: string[] | null
  governance_equity_notes: string | null
  extractor_notes: string | null
}

export interface JobStatus {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'error'
  total: number
  completed: number
  errors: number
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  current_record_id: number | null
  current_record_title: string | null
}
