import { api } from './client'
import type { Review, PhaseSummary, IRRResult, JobStatus, Record as ReviewRecord, Extraction, ExtractionListItem } from './types'

// Reviews
export const getReviews = () => api.get<Review[]>('/reviews/').then(r => r.data)
export const getReview = (id: number) => api.get<Review>(`/reviews/${id}`).then(r => r.data)
export const createReview = (body: { name: string; description?: string; osf_url?: string }) =>
  api.post<Review>('/reviews/', body).then(r => r.data)

// Config
export const getConfig = () => api.get<{ llm_provider: string; llm_model: string }>('/config').then(r => r.data)

// Records
export const getRecords = (
  reviewId: number,
  params?: { phase?: number; screened_human?: boolean; screened_agent?: boolean }
) => api.get<ReviewRecord[]>(`/reviews/${reviewId}/records/`, { params }).then(r => r.data)

export const getRecord = (reviewId: number, recordId: number) =>
  api.get<ReviewRecord>(`/reviews/${reviewId}/records/${recordId}`).then(r => r.data)

export const saveHumanDecision = (
  reviewId: number,
  recordId: number,
  body: { decision: string; exclusion_reason?: string; notes?: string; phase: number }
) => api.post(`/reviews/${reviewId}/records/${recordId}/human-decision`, body).then(r => r.data)

export const saveResolution = (
  reviewId: number,
  recordId: number,
  body: { final_decision: string; resolution_notes?: string }
) => api.post(`/reviews/${reviewId}/records/${recordId}/resolution`, body).then(r => r.data)

// Import
export const importRIS = (reviewId: number, file: File, phase: number, source_type: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('phase', String(phase))
  form.append('source_type', source_type)
  return api.post(`/reviews/${reviewId}/records/import/ris`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const importCSV = (reviewId: number, file: File, phase: number, source_type: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('phase', String(phase))
  form.append('source_type', source_type)
  return api.post(`/reviews/${reviewId}/records/import/csv`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

// Agent
export const runAgent = (reviewId: number, phase: number, sampleIds?: number[]) =>
  api.post<{ job_id: string; total: number }>('/agent/run', {
    review_id: reviewId,
    phase,
    sample_ids: sampleIds,
  }).then(r => r.data)

export const getJobStatus = (jobId: string) =>
  api.get<JobStatus>(`/agent/jobs/${jobId}`).then(r => r.data)

// IRR
export const getIRR = (reviewId: number, phase?: number) =>
  api.get<IRRResult>(`/reviews/${reviewId}/irr/`, { params: phase ? { phase } : {} }).then(r => r.data)

export const getIRRSummary = (reviewId: number) =>
  api.get<PhaseSummary[]>(`/reviews/${reviewId}/irr/summary`).then(r => r.data)

// Export
export const exportCSV = (reviewId: number, phase: number) =>
  window.open(`/api/reviews/${reviewId}/export/csv?phase=${phase}`, '_blank')

// Full-text (Phase 2)
export const promoteToPhase2 = (reviewId: number) =>
  api.post<{ promoted: number; record_ids: number[] }>(`/reviews/${reviewId}/fulltext/promote`).then(r => r.data)

export const linkZoteroPDFs = (reviewId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ linked: number; total_phase2: number; not_in_csv: string[]; file_missing: { external_id: string; path: string }[] }>(
    `/reviews/${reviewId}/fulltext/link-zotero`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ).then(r => r.data)
}

export const getPhase2Status = (reviewId: number) =>
  api.get<{ id: number; external_id: string | null; title: string | null; has_pdf: boolean; human_decision: string | null; human_decision_phase2: string | null; agent_decision: string | null; agent_phase: number | null }[]>(
    `/reviews/${reviewId}/fulltext/status`
  ).then(r => r.data)

export const uploadRecordPDF = (reviewId: number, recordId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ record_id: number; path: string }>(
    `/reviews/${reviewId}/fulltext/${recordId}/pdf`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ).then(r => r.data)
}

export const getPdfUrl = (reviewId: number, recordId: number) =>
  `/api/reviews/${reviewId}/fulltext/${recordId}/pdf`

export const getContentUrl = (reviewId: number, recordId: number) =>
  `/api/reviews/${reviewId}/fulltext/${recordId}/content`

// Extraction (data charting)
export const listExtractions = (reviewId: number) =>
  api.get<ExtractionListItem[]>(`/reviews/${reviewId}/extraction`).then(r => r.data)

export const getExtraction = (reviewId: number, recordId: number) =>
  api.get<Extraction | null>(`/reviews/${reviewId}/extraction/${recordId}`).then(r => r.data)

export const saveExtraction = (reviewId: number, recordId: number, data: Partial<Extraction>) =>
  api.put<Extraction>(`/reviews/${reviewId}/extraction/${recordId}`, data).then(r => r.data)

export const exportExtractionCSV = (reviewId: number) =>
  window.open(`/api/reviews/${reviewId}/extraction/export/csv`, '_blank')
