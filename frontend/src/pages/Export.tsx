import { useParams } from 'react-router-dom'
import { exportCSV } from '../api/reviews'
import { api } from '../api/client'

export default function Export() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const id = Number(reviewId)

  const exportConflicts = () =>
    window.open(`/api/reviews/${id}/export/conflicts`, '_blank')

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Export Data</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-sm text-slate-600">
          Download screening decisions as CSV for each phase. Includes human decisions,
          agent decisions, agreement status, and resolved final decisions.
        </p>

        {[1, 2, 3].map(phase => (
          <button
            key={phase}
            onClick={() => exportCSV(id, phase)}
            className="w-full py-2.5 text-left px-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 flex justify-between items-center transition-colors"
          >
            <span className="font-medium text-slate-700">
              Phase {phase} — {['', 'Title & Abstract', 'Full Text', 'Grey Literature'][phase]}
            </span>
            <span className="text-sm text-blue-600">Download CSV ↓</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-sm text-slate-600">
          Conflicts only — records where human and agent gave different definitive decisions (agent Uncertain excluded per Option 2).
        </p>
        <button
          onClick={exportConflicts}
          className="w-full py-2.5 text-left px-4 border border-amber-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 flex justify-between items-center transition-colors"
        >
          <span className="font-medium text-slate-700">T/A Conflicts — Human vs Agent</span>
          <span className="text-sm text-amber-600">Download CSV ↓</span>
        </button>
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <p>CSV columns: record ID, title, authors, year, source, human decision, agent decision, confidence, rationale, agreement, final decision.</p>
        <p>Audit logs (full prompts + raw LLM responses) are stored in <code>audit/</code> as JSONL files.</p>
      </div>
    </div>
  )
}
