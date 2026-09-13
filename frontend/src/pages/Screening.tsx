import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRecords, saveHumanDecision, getPdfUrl, getContentUrl } from '../api/reviews'
import type { Record as ReviewRecord } from '../api/types'

const EXCLUSION_REASONS = [
  'Population not in LMICs',
  'Setting not primary care',
  'No AI/ML implementation',
  'No responsible AI dimension',
  'Ineligible study type (abstract/editorial/letter)',
  'Published before 2015',
  'Not in English',
  'Duplicate record',
  'Other',
]

const EXCLUSION_REASONS_P3 = [
  'Criterion 1 not met — source not credible or traceable',
  'Criterion 2 not met — not directly relevant to responsible AI in health',
  'Criterion 3 not met — not additive (content captured by existing literature)',
  'Duplicate grey literature source',
  'Other',
]

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-slate-400 text-xs">Not screened</span>
  const colours: Record<string, string> = {
    Include: 'bg-green-100 text-green-700',
    Exclude: 'bg-red-100 text-red-700',
    Uncertain: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colours[decision] ?? 'bg-slate-100 text-slate-600'}`}>
      {decision}
    </span>
  )
}

type FilterMode = 'all' | 'conflicts' | 'uncertain' | 'unscreened' | 'screened'

export default function Screening() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const [searchParams] = useSearchParams()
  const id = Number(reviewId)
  const phase = Number(searchParams.get('phase') ?? 1)
  const activeReasons = phase === 3 ? EXCLUSION_REASONS_P3 : EXCLUSION_REASONS
  const qc = useQueryClient()

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['records', id, phase],
    queryFn: () => getRecords(id, { phase }),
  })

  const [idx, setIdx] = useState(0)
  const [exclusionReason, setExclusionReason] = useState('')
  const [notes, setNotes] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [jumpInput, setJumpInput] = useState('')

  const filtered = records.filter(r => {
    if (filter === 'conflicts') {
      return r.human_decision && r.agent_decision &&
        r.agent_decision.decision !== 'Uncertain' &&
        r.human_decision.decision !== r.agent_decision.decision
    }
    if (filter === 'uncertain') return r.agent_decision?.decision === 'Uncertain'
    if (filter === 'unscreened') return !r.human_decision
    if (filter === 'screened') return !!r.human_decision
    return true
  })

  const record: ReviewRecord | undefined = filtered[idx]

  // Reset idx when filter changes
  useEffect(() => { setIdx(0) }, [filter])

  // Reset form when record changes
  useEffect(() => {
    setExclusionReason(record?.human_decision?.exclusion_reason ?? '')
    setNotes(record?.human_decision?.notes ?? '')
  }, [idx, record?.id])

  const jumpToId = () => {
    const target = jumpInput.trim()
    const i = filtered.findIndex(r =>
      r.external_id === target ||
      String(r.id) === target ||
      r.title?.toLowerCase().includes(target.toLowerCase())
    )
    if (i >= 0) { setIdx(i); setJumpInput('') }
    else alert(`Not found in current filter: "${target}"`)
  }

  const saveMutation = useMutation({
    mutationFn: (decision: string) =>
      saveHumanDecision(id, record!.id, {
        decision,
        exclusion_reason: decision === 'Exclude' ? exclusionReason : undefined,
        notes: notes || undefined,
        phase,
      }),
    onSuccess: (_, decision) => {
      const recordId = record?.id
      if (recordId != null) {
        qc.setQueryData(['records', id, phase], (old: ReviewRecord[] | undefined) => {
          if (!old) return old
          return old.map(r =>
            r.id === recordId
              ? {
                  ...r,
                  human_decision: {
                    decision,
                    exclusion_reason: decision === 'Exclude' ? exclusionReason : null,
                    notes: notes || null,
                    phase,
                    record_id: recordId,
                  },
                }
              : r
          )
        })
      }
      qc.invalidateQueries({ queryKey: ['irr', id] })
    },
  })

  const decide = useCallback((decision: string) => {
    if (!record) return
    if (decision === 'Exclude' && !exclusionReason) {
      alert('Please select an exclusion reason.')
      return
    }
    saveMutation.mutate(decision)
  }, [record, exclusionReason, notes, saveMutation])

  const saveAndNavigate = useCallback((nextIdx: number) => {
    if (record?.human_decision) {
      saveMutation.mutate(record.human_decision.decision)
    }
    setIdx(nextIdx)
  }, [record, saveMutation])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'i' || e.key === 'I') decide('Include')
      if (e.key === 'e' || e.key === 'E') decide('Exclude')
      if (e.key === 'u' || e.key === 'U') decide('Uncertain')
      if (e.key === 'ArrowLeft') saveAndNavigate(Math.max(0, idx - 1))
      if (e.key === 'ArrowRight') saveAndNavigate(Math.min(filtered.length - 1, idx + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [decide, saveAndNavigate, idx, records.length])

  if (isLoading) return <div className="text-slate-400">Loading records…</div>
  if (records.length === 0) return (
    <div className="text-slate-500">
      No records for Phase {phase}.{' '}
      {phase === 2 && (
        <Link to={`/review/${id}/fulltext`} className="text-blue-600 underline">
          Set up Phase 2 first.
        </Link>
      )}
    </div>
  )

  const screened = records.filter(r => r.human_decision).length
  const isPhase2 = phase === 2
  const isPhase3 = phase === 3

  return (
    <div className={(isPhase2 || isPhase3) ? 'space-y-4' : 'max-w-3xl space-y-4'}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Phase {phase} Screening</h1>
        <span className="text-sm text-slate-500">{screened} / {records.length} screened</span>
      </div>

      {/* Progress bar */}
      <div className="bg-slate-200 rounded-full h-1.5">
        <div className="bg-green-500 h-1.5 rounded-full transition-all"
          style={{ width: `${records.length > 0 ? (screened / records.length) * 100 : 0}%` }} />
      </div>

      {/* Filter + jump */}
      <div className="flex gap-2 flex-wrap items-center">
        <select
          className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          value={filter}
          onChange={e => setFilter(e.target.value as FilterMode)}
        >
          <option value="all">All records ({records.length})</option>
          <option value="conflicts">Conflicts only ({records.filter(r => r.human_decision && r.agent_decision && r.agent_decision.decision !== 'Uncertain' && r.human_decision.decision !== r.agent_decision.decision).length})</option>
          <option value="uncertain">Agent uncertain ({records.filter(r => r.agent_decision?.decision === 'Uncertain').length})</option>
          <option value="unscreened">Not yet screened by me ({records.filter(r => !r.human_decision).length})</option>
          <option value="screened">Screened by me ({screened})</option>
        </select>
        <input
          className="border border-slate-300 rounded px-3 py-1.5 text-sm w-44"
          placeholder="Jump: Covidence ID or title"
          value={jumpInput}
          onChange={e => setJumpInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && jumpToId()}
        />
        <button onClick={jumpToId} className="px-3 py-1.5 text-sm border rounded hover:bg-slate-50">Go</button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => saveAndNavigate(Math.max(0, idx - 1))} disabled={idx === 0}
          className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-slate-50">← Prev</button>
        <span className="text-sm text-slate-500">{idx + 1} of {filtered.length}</span>
        <button onClick={() => saveAndNavigate(Math.min(filtered.length - 1, idx + 1))} disabled={idx === filtered.length - 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-slate-50">Next →</button>
        {record?.human_decision && <DecisionBadge decision={record.human_decision.decision} />}
      </div>

      {record && (
        isPhase3 ? (
          /* ── Phase 3 split layout: document (PDF or txt) + decision panel ── */
          <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
            {/* Document panel */}
            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex flex-col">
              {record.full_text_path ? (
                <iframe
                  key={record.id}
                  src={getContentUrl(id, record.id)}
                  className="w-full flex-1"
                  title="Grey literature document"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
                  <span className="text-4xl">📄</span>
                  <p className="text-sm font-medium">No file linked for this record.</p>
                  <p className="text-xs text-slate-400">Run gl_db_update.py or gl_fetch_webpages.py to link documents.</p>
                </div>
              )}
            </div>

            {/* Decision panel */}
            <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-5 space-y-4 overflow-y-auto">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 leading-snug">{record.title ?? 'No title'}</h2>
                <p className="text-xs text-slate-400 mt-1">{record.year} · {record.source}</p>
                {record.external_id && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{record.external_id}</p>
                )}
              </div>

              {/* Agent decision summary with grey lit criteria */}
              {record.agent_decision && (
                <div className={`rounded p-3 text-xs space-y-2 ${
                  record.agent_decision.decision === 'Include' ? 'bg-green-50 border border-green-200' :
                  record.agent_decision.decision === 'Exclude' ? 'bg-red-50 border border-red-200' :
                  'bg-amber-50 border border-amber-200'
                }`}>
                  <p className="font-medium text-slate-700">
                    AI:&nbsp;
                    <span className={
                      record.agent_decision.decision === 'Include' ? 'text-green-700' :
                      record.agent_decision.decision === 'Exclude' ? 'text-red-700' : 'text-amber-700'
                    }>{record.agent_decision.decision}</span>
                    {record.agent_decision.confidence != null && (
                      <span className="text-slate-400 font-normal"> · {(record.agent_decision.confidence * 100).toFixed(0)}%</span>
                    )}
                  </p>
                  {record.agent_decision.grey_lit_criteria && (
                    <div className="space-y-0.5">
                      {Object.entries(record.agent_decision.grey_lit_criteria).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1.5">
                          <span className={v === 'met' ? 'text-green-600' : v === 'not_met' ? 'text-red-600' : 'text-amber-600'}>
                            {v === 'met' ? '✓' : v === 'not_met' ? '✗' : '?'}
                          </span>
                          <span className="text-slate-600 capitalize">{k.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {record.agent_decision.rationale && (
                    <p className="text-slate-600 leading-relaxed">{record.agent_decision.rationale}</p>
                  )}
                  {record.agent_decision.exclusion_reason && (
                    <p className="text-slate-500 italic">{record.agent_decision.exclusion_reason}</p>
                  )}
                </div>
              )}

              {/* Decision buttons */}
              <div className="flex flex-col gap-2">
                <button onClick={() => decide('Include')} disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 text-sm">
                  Include <kbd className="ml-1 text-xs opacity-70">I</kbd>
                </button>
                <button onClick={() => decide('Exclude')} disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 text-sm">
                  Exclude <kbd className="ml-1 text-xs opacity-70">E</kbd>
                </button>
                <button onClick={() => decide('Uncertain')} disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-40 text-sm">
                  Uncertain <kbd className="ml-1 text-xs opacity-70">U</kbd>
                </button>
              </div>

              {/* Exclusion reason */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Exclusion reason <span className="text-red-500">*</span>
                </label>
                <select className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  value={exclusionReason} onChange={e => setExclusionReason(e.target.value)}>
                  <option value="">— Select reason —</option>
                  {exclusionReason && !activeReasons.includes(exclusionReason) && (
                    <option key="__imported__" value={exclusionReason}>{exclusionReason}</option>
                  )}
                  {activeReasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs resize-none"
                  rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Free-text notes…" />
              </div>
            </div>
          </div>
        ) : isPhase2 ? (
          /* ── Phase 2 split layout ── */
          <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
            {/* PDF panel */}
            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex flex-col">
              {record.full_text_path ? (
                <iframe
                  key={record.id}
                  src={getPdfUrl(id, record.id)}
                  className="w-full flex-1"
                  title="Full text PDF"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
                  <span className="text-4xl">📄</span>
                  <p className="text-sm font-medium">No PDF linked for this record.</p>
                  <Link to={`/review/${id}/fulltext`} className="text-blue-600 text-sm underline">
                    Go to Full Text setup to link PDFs
                  </Link>
                </div>
              )}
            </div>

            {/* Decision panel */}
            <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-5 space-y-4 overflow-y-auto">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 leading-snug">{record.title ?? 'No title'}</h2>
                <p className="text-xs text-slate-400 mt-1">{record.year} · {record.source}</p>
              </div>

              {/* AI decision summary */}
              {record.agent_decision && (
                <div className={`rounded p-3 text-xs space-y-1 ${
                  record.agent_decision.decision === 'Include' ? 'bg-green-50 border border-green-200' :
                  record.agent_decision.decision === 'Exclude' ? 'bg-red-50 border border-red-200' :
                  'bg-amber-50 border border-amber-200'
                }`}>
                  <p className="font-medium text-slate-700">
                    AI ({record.agent_decision.phase === 2 ? 'full text' : 'title/abstract'}):&nbsp;
                    <span className={
                      record.agent_decision.decision === 'Include' ? 'text-green-700' :
                      record.agent_decision.decision === 'Exclude' ? 'text-red-700' : 'text-amber-700'
                    }>{record.agent_decision.decision}</span>
                    {record.agent_decision.confidence != null && (
                      <span className="text-slate-400 font-normal"> · {(record.agent_decision.confidence * 100).toFixed(0)}%</span>
                    )}
                  </p>
                  {record.agent_decision.rationale && (
                    <p className="text-slate-600 leading-relaxed">{record.agent_decision.rationale}</p>
                  )}
                  {record.agent_decision.exclusion_reason && (
                    <p className="text-slate-500 italic">{record.agent_decision.exclusion_reason}</p>
                  )}
                </div>
              )}

              {/* Abstract (collapsed) */}
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">Abstract</summary>
                <p className="mt-2 text-slate-600 leading-relaxed">{record.abstract ?? 'No abstract'}</p>
              </details>

              {/* Decision buttons */}
              <div className="flex flex-col gap-2">
                <button onClick={() => decide('Include')} disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 text-sm">
                  Include <kbd className="ml-1 text-xs opacity-70">I</kbd>
                </button>
                <button onClick={() => decide('Exclude')} disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 text-sm">
                  Exclude <kbd className="ml-1 text-xs opacity-70">E</kbd>
                </button>
                <button onClick={() => decide('Uncertain')} disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-40 text-sm">
                  Uncertain <kbd className="ml-1 text-xs opacity-70">U</kbd>
                </button>
              </div>

              {/* Exclusion reason */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Exclusion reason <span className="text-red-500">*</span>
                </label>
                <select className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  value={exclusionReason} onChange={e => setExclusionReason(e.target.value)}>
                  <option value="">— Select reason —</option>
                  {exclusionReason && !activeReasons.includes(exclusionReason) && (
                    <option key="__imported__" value={exclusionReason}>{exclusionReason}</option>
                  )}
                  {activeReasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs resize-none"
                  rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Free-text notes…" />
              </div>
            </div>
          </div>
        ) : (
          /* ── Phase 1 original layout ── */
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 leading-snug">{record.title ?? 'No title'}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {record.authors} · {record.year} · {record.source}
              </p>
            </div>

            <div className="bg-slate-50 rounded p-4 text-sm text-slate-700 leading-relaxed max-h-72 overflow-y-auto">
              {record.abstract ?? <span className="text-slate-400 italic">No abstract</span>}
            </div>

            {/* Decision buttons */}
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => decide('Include')} disabled={saveMutation.isPending}
                className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40">
                Include <kbd className="ml-1 text-xs opacity-70">I</kbd>
              </button>
              <button onClick={() => decide('Exclude')} disabled={saveMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40">
                Exclude <kbd className="ml-1 text-xs opacity-70">E</kbd>
              </button>
              <button onClick={() => decide('Uncertain')} disabled={saveMutation.isPending}
                className="px-5 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-40">
                Uncertain <kbd className="ml-1 text-xs opacity-70">U</kbd>
              </button>
            </div>

            {/* Exclusion reason */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Exclusion reason <span className="text-red-500">*</span> (required if Exclude)
              </label>
              <select className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={exclusionReason} onChange={e => setExclusionReason(e.target.value)}>
                <option value="">— Select reason —</option>
                {exclusionReason && !activeReasons.includes(exclusionReason) && (
                  <option key="__imported__" value={exclusionReason}>{exclusionReason}</option>
                )}
                {activeReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Notes (optional)</label>
              <textarea className="w-full border border-slate-300 rounded px-3 py-2 text-sm resize-none"
                rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Free-text notes…" />
            </div>
          </div>
        )
      )}

      <p className="text-xs text-slate-400">
        Keyboard: <kbd>I</kbd> Include · <kbd>E</kbd> Exclude · <kbd>U</kbd> Uncertain · <kbd>←</kbd><kbd>→</kbd> Navigate
      </p>
    </div>
  )
}
