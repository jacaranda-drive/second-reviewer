import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getReview, getIRRSummary, getConfig } from '../api/reviews'
import type { PhaseSummary } from '../api/types'

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex-1 bg-slate-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-500 w-20 text-right">{value} / {max}</span>
    </div>
  )
}

function PhaseCard({ s, reviewId, navigate }: { s: PhaseSummary; reviewId: string; navigate: ReturnType<typeof useNavigate> }) {
  const phaseLabel = ['', 'Title & Abstract', 'Full Text', 'Grey Literature'][s.phase]
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">Phase {s.phase} — {phaseLabel}</h3>
        <span className="text-xs text-slate-400">{s.total} records</span>
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1">Human screened</div>
        <ProgressBar value={s.human_done} max={s.total} color="bg-green-500" />
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1">Agent screened</div>
        <ProgressBar value={s.agent_done} max={s.total} color="bg-blue-500" />
      </div>
      {s.conflicts_unresolved > 0 && (
        <div className="text-xs text-amber-600 font-medium">
          ⚠ {s.conflicts_unresolved} unresolved conflict{s.conflicts_unresolved !== 1 ? 's' : ''}
        </div>
      )}
      <div className="flex gap-2 flex-wrap pt-1">
        <button
          onClick={() => navigate(`/review/${reviewId}/screening?phase=${s.phase}`)}
          className="px-3 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
        >
          Continue screening
        </button>
        <button
          onClick={() => navigate(`/review/${reviewId}/run-agent?phase=${s.phase}`)}
          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
        >
          Run agent
        </button>
        {s.conflicts_unresolved > 0 && (
          <button
            onClick={() => navigate(`/review/${reviewId}/conflicts?phase=${s.phase}`)}
            className="px-3 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100"
          >
            Resolve conflicts
          </button>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const navigate = useNavigate()
  const id = Number(reviewId)

  const { data: review } = useQuery({ queryKey: ['review', id], queryFn: () => getReview(id) })
  const { data: summary = [] } = useQuery({ queryKey: ['irr-summary', id], queryFn: () => getIRRSummary(id) })
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{review?.name ?? 'Loading…'}</h1>
        {review?.osf_url && (
          <a href={review.osf_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline">
            OSF Registration ↗
          </a>
        )}
        {review?.description && <p className="text-slate-500 text-sm mt-1">{review.description}</p>}
        {config && (
          <p className="text-xs text-slate-400 mt-1">
            Active LLM: <span className="font-mono">{config.llm_provider} / {config.llm_model}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(phase => {
          const s = summary.find(x => x.phase === phase) ?? { phase, total: 0, human_done: 0, agent_done: 0, n_paired: 0, conflicts_unresolved: 0 }
          return <PhaseCard key={phase} s={s} reviewId={reviewId!} navigate={navigate} />
        })}
      </div>
    </div>
  )
}
