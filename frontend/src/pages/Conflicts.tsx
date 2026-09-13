import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRecords, saveResolution } from '../api/reviews'
import type { Record as ReviewRecord } from '../api/types'

const DECISIONS = ['Include', 'Exclude', 'Uncertain'] as const

export default function Conflicts() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const [searchParams] = useSearchParams()
  const id = Number(reviewId)
  const phase = Number(searchParams.get('phase') ?? 1)
  const qc = useQueryClient()

  const [filterPhase, setFilterPhase] = useState(phase)

  const { data: records = [] } = useQuery({
    queryKey: ['records', id, filterPhase],
    queryFn: () => getRecords(id, { phase: filterPhase }),
  })

  // True conflicts: agent gave Include/Exclude but disagrees with human (not Uncertain)
  const conflicts = records.filter(r =>
    r.human_decision && r.agent_decision &&
    r.agent_decision.decision !== 'Uncertain' &&
    r.human_decision.decision !== r.agent_decision.decision &&
    !r.resolution
  )

  // Agent Uncertain = needs human review
  const needsReview = records.filter(r =>
    r.human_decision && r.agent_decision &&
    r.agent_decision.decision === 'Uncertain' &&
    !r.resolution
  )

  const [idx, setIdx] = useState(0)
  const [finalDecision, setFinalDecision] = useState<string>('')
  const [resolutionNotes, setResolutionNotes] = useState('')

  const record: ReviewRecord | undefined = conflicts[idx]

  useEffect(() => {
    setFinalDecision(record?.human_decision?.decision ?? '')
    setResolutionNotes('')
  }, [idx, record?.id])

  const resolveMutation = useMutation({
    mutationFn: () => saveResolution(id, record!.id, {
      final_decision: finalDecision,
      resolution_notes: resolutionNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records', id, filterPhase] })
      qc.invalidateQueries({ queryKey: ['irr-summary', id] })
      // Stay at same index (next conflict will take this position)
    },
  })

  const acceptHuman = useCallback(() => {
    setFinalDecision(record?.human_decision?.decision ?? '')
  }, [record])

  const acceptAgent = useCallback(() => {
    setFinalDecision(record?.agent_decision?.decision ?? '')
  }, [record])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'h' || e.key === 'H') acceptHuman()
      if (e.key === 'a' || e.key === 'A') acceptAgent()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [acceptHuman, acceptAgent])

  if (conflicts.length === 0) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Conflict Resolution</h1>
      <div>
        <select className="border border-slate-300 rounded px-3 py-1.5 text-sm mb-4" value={filterPhase} onChange={e => { setFilterPhase(Number(e.target.value)); setIdx(0) }}>
          <option value={1}>Phase 1</option>
          <option value={2}>Phase 2</option>
          <option value={3}>Phase 3</option>
        </select>
      </div>
      <p className="text-green-600 font-medium">No unresolved conflicts for Phase {filterPhase}.</p>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Conflict Resolution</h1>
        <div className="flex gap-3 text-sm text-slate-500">
          <span>{idx + 1} of {conflicts.length} conflicts</span>
          {needsReview.length > 0 && (
            <span className="text-amber-600 font-medium">{needsReview.length} agent-uncertain (needs review)</span>
          )}
        </div>
      </div>

      <select className="border border-slate-300 rounded px-3 py-1.5 text-sm" value={filterPhase} onChange={e => { setFilterPhase(Number(e.target.value)); setIdx(0) }}>
        <option value={1}>Phase 1</option>
        <option value={2}>Phase 2</option>
        <option value={3}>Phase 3</option>
      </select>

      <div className="flex gap-2">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          className="px-3 py-1 text-sm border rounded disabled:opacity-30">← Prev</button>
        <button onClick={() => setIdx(i => Math.min(conflicts.length - 1, i + 1))} disabled={idx === conflicts.length - 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-30">Next →</button>
      </div>

      {record && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{record.title}</h2>
            <p className="text-xs text-slate-400">{record.authors} · {record.year} · {record.source}</p>
          </div>

          <div className="text-sm text-slate-700 bg-slate-50 rounded p-3 max-h-40 overflow-y-auto">
            {record.abstract ?? <span className="italic text-slate-400">No abstract</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Human panel */}
            <div className="bg-green-50 border border-green-100 rounded p-4 space-y-2">
              <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Human decision</p>
              <p className="text-lg font-bold text-green-800">{record.human_decision!.decision}</p>
              {record.human_decision!.exclusion_reason && (
                <p className="text-sm text-slate-600">{record.human_decision!.exclusion_reason}</p>
              )}
              {record.human_decision!.notes && (
                <p className="text-sm text-slate-500 italic whitespace-pre-wrap">{record.human_decision!.notes}</p>
              )}
              <button onClick={acceptHuman}
                className="text-xs px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200">
                Accept human <kbd className="ml-1 opacity-70">H</kbd>
              </button>
            </div>

            {/* Agent panel */}
            <div className="bg-blue-50 border border-blue-100 rounded p-4 space-y-2">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Agent decision</p>
              <p className="text-lg font-bold text-blue-800">{record.agent_decision!.decision}</p>
              {record.agent_decision!.confidence != null && (
                <p className="text-xs text-slate-500">Confidence: {Math.round(record.agent_decision!.confidence * 100)}%</p>
              )}
              {record.agent_decision!.exclusion_reason && (
                <p className="text-sm text-slate-600">{record.agent_decision!.exclusion_reason}</p>
              )}
              {record.agent_decision!.rationale && (
                <p className="text-sm text-slate-600">{record.agent_decision!.rationale}</p>
              )}
              {record.agent_decision!.evidence_quotes?.length > 0 && (
                <ul className="text-xs space-y-1">
                  {record.agent_decision!.evidence_quotes.map((q, i) => (
                    <li key={i} className="italic border-l-2 border-blue-200 pl-2 text-slate-600">{q}</li>
                  ))}
                </ul>
              )}
              <button onClick={acceptAgent}
                className="text-xs px-3 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded hover:bg-blue-200">
                Accept agent <kbd className="ml-1 opacity-70">A</kbd>
              </button>
            </div>
          </div>

          {/* Final decision */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Final decision (yours as human arbiter)</p>
            <div className="flex gap-2 flex-wrap">
              {DECISIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setFinalDecision(d)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    finalDecision === d
                      ? d === 'Include' ? 'bg-green-600 text-white border-green-600'
                        : d === 'Exclude' ? 'bg-red-600 text-white border-red-600'
                        : 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <textarea
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm resize-none"
              rows={2}
              placeholder="Resolution notes (optional)…"
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
            />
            <button
              onClick={() => resolveMutation.mutate()}
              disabled={!finalDecision || resolveMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              {resolveMutation.isPending ? 'Saving…' : 'Confirm resolution'}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Keyboard: <kbd>H</kbd> accept human · <kbd>A</kbd> accept agent
      </p>
    </div>
  )
}
