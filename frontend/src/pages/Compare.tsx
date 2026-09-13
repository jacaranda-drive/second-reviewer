import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRecords } from '../api/reviews'
import type { Record as ReviewRecord } from '../api/types'

function DecisionCell({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-slate-300">—</span>
  const cls: Record<string, string> = {
    Include: 'text-green-700 font-medium',
    Exclude: 'text-red-700 font-medium',
    Uncertain: 'text-amber-600 font-medium',
  }
  return <span className={cls[decision] ?? ''}>{decision}</span>
}

function DetailPanel({ record, onClose }: { record: ReviewRecord; onClose: () => void }) {
  const ad = record.agent_decision
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-semibold text-slate-800 pr-4">{record.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <p className="text-xs text-slate-400">{record.authors} · {record.year} · {record.source}</p>
        <div className="text-sm text-slate-700 bg-slate-50 rounded p-3 max-h-40 overflow-y-auto">
          {record.abstract}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded p-3">
            <p className="text-xs font-medium text-green-700 mb-1">Human decision</p>
            <p className="font-semibold">{record.human_decision?.decision ?? '—'}</p>
            {record.human_decision?.exclusion_reason && (
              <p className="text-xs text-slate-500 mt-1">{record.human_decision.exclusion_reason}</p>
            )}
            {record.human_decision?.notes && (
              <p className="text-xs text-slate-500 italic mt-1 whitespace-pre-wrap">{record.human_decision.notes}</p>
            )}
          </div>
          <div className="bg-blue-50 rounded p-3">
            <p className="text-xs font-medium text-blue-700 mb-1">Agent decision</p>
            <p className="font-semibold">{ad?.decision ?? '—'}</p>
            {ad?.confidence != null && (
              <p className="text-xs text-slate-500">Confidence: {Math.round(ad.confidence * 100)}%</p>
            )}
            {ad?.exclusion_reason && (
              <p className="text-xs text-slate-500 mt-1">{ad.exclusion_reason}</p>
            )}
          </div>
        </div>
        {ad?.rationale && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Agent rationale</p>
            <p className="text-sm text-slate-700">{ad.rationale}</p>
          </div>
        )}
        {ad?.evidence_quotes && ad.evidence_quotes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Evidence quotes</p>
            <ul className="space-y-1">
              {ad.evidence_quotes.map((q, i) => (
                <li key={i} className="text-sm text-slate-600 italic border-l-2 border-blue-200 pl-2">{q}</li>
              ))}
            </ul>
          </div>
        )}
        {ad?.flags && ad.flags.length > 0 && (
          <div>
            <p className="text-xs font-medium text-amber-600 mb-1">Flags</p>
            <ul className="flex flex-wrap gap-1">
              {ad.flags.map((f, i) => (
                <li key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Compare() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const [searchParams] = useSearchParams()
  const id = Number(reviewId)
  const phase = Number(searchParams.get('phase') ?? 1)

  const [filterPhase, setFilterPhase] = useState(phase)
  const [filterAgreement, setFilterAgreement] = useState<'all' | 'agree' | 'conflict'>('all')
  const [selected, setSelected] = useState<ReviewRecord | null>(null)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['records', id, filterPhase],
    queryFn: () => getRecords(id, { phase: filterPhase }),
  })

  const paired = records.filter(r => r.human_decision && r.agent_decision)
  const filtered = paired.filter(r => {
    if (filterAgreement === 'agree') return r.human_decision!.decision === r.agent_decision!.decision
    if (filterAgreement === 'conflict') return r.human_decision!.decision !== r.agent_decision!.decision
    return true
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Compare Decisions</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select className="border border-slate-300 rounded px-3 py-1.5 text-sm" value={filterPhase} onChange={e => setFilterPhase(Number(e.target.value))}>
          <option value={1}>Phase 1</option>
          <option value={2}>Phase 2</option>
          <option value={3}>Phase 3</option>
        </select>
        <select className="border border-slate-300 rounded px-3 py-1.5 text-sm" value={filterAgreement} onChange={e => setFilterAgreement(e.target.value as typeof filterAgreement)}>
          <option value="all">All ({paired.length})</option>
          <option value="agree">Agreement only</option>
          <option value="conflict">Conflicts only</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500">No paired decisions yet for Phase {filterPhase}.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 text-slate-600 font-medium">Title</th>
                <th className="px-4 py-2 text-slate-600 font-medium">Human</th>
                <th className="px-4 py-2 text-slate-600 font-medium">Agent</th>
                <th className="px-4 py-2 text-slate-600 font-medium">Conf.</th>
                <th className="px-4 py-2 text-slate-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const agree = r.human_decision!.decision === r.agent_decision!.decision
                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-2 max-w-xs truncate text-slate-700">{r.title ?? '—'}</td>
                    <td className="px-4 py-2 text-center"><DecisionCell decision={r.human_decision?.decision ?? null} /></td>
                    <td className="px-4 py-2 text-center"><DecisionCell decision={r.agent_decision?.decision ?? null} /></td>
                    <td className="px-4 py-2 text-center text-slate-500 text-xs">
                      {r.agent_decision?.confidence != null ? `${Math.round(r.agent_decision.confidence * 100)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {agree
                        ? <span className="text-green-600">✓</span>
                        : <span className="text-amber-500">⚠</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <DetailPanel record={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
