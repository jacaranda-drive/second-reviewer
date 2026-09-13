import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRecords, runAgent, getJobStatus } from '../api/reviews'

export default function RunAgent() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const [searchParams] = useSearchParams()
  const id = Number(reviewId)
  const defaultPhase = Number(searchParams.get('phase') ?? 1)
  const qc = useQueryClient()

  const [phase, setPhase] = useState(defaultPhase)
  const [jobId, setJobId] = useState<string | null>(null)

  const { data: records = [] } = useQuery({
    queryKey: ['records', id, phase],
    queryFn: () => getRecords(id, { phase }),
  })

  const unscreened = records.filter(r => !r.agent_decision).length

  const conflictIds = records
    .filter(r => r.human_decision && r.agent_decision &&
      r.agent_decision.decision !== 'Uncertain' &&
      r.human_decision.decision !== r.agent_decision.decision)
    .map(r => r.id)

  const uncertainIds = records
    .filter(r => r.agent_decision?.decision === 'Uncertain')
    .map(r => r.id)

  const runMutation = useMutation({
    mutationFn: (sampleIds?: number[]) => runAgent(id, phase, sampleIds),
    onSuccess: (data) => {
      if (data.job_id) setJobId(data.job_id)
    },
  })

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' || status === 'queued' ? 2000 : false
    },
  })

  useEffect(() => {
    if (job?.status === 'done') {
      qc.invalidateQueries({ queryKey: ['records', id, phase] })
      qc.invalidateQueries({ queryKey: ['irr-summary', id] })
    }
  }, [job?.status])

  const processed = job ? job.completed + job.errors : 0
  const pct = job && job.total > 0 ? Math.round((processed / job.total) * 100) : 0

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Run Agent Screening</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Phase</label>
          <select
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            value={phase}
            onChange={e => { setPhase(Number(e.target.value)); setJobId(null) }}
          >
            <option value={1}>Phase 1 — Title &amp; Abstract</option>
            <option value={2}>Phase 2 — Full Text</option>
            <option value={3}>Phase 3 — Grey Literature</option>
          </select>
        </div>

        <div className="text-sm text-slate-600">
          <strong>{unscreened}</strong> of {records.length} records not yet screened by agent.
        </div>

        <button
          onClick={() => runMutation.mutate(undefined)}
          disabled={runMutation.isPending || unscreened === 0 || (job?.status === 'running' || job?.status === 'queued')}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          {runMutation.isPending ? 'Starting…' : `Screen ${unscreened} unscreened records`}
        </button>

        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Re-screen subset</p>
          <button
            onClick={() => runMutation.mutate(conflictIds)}
            disabled={runMutation.isPending || conflictIds.length === 0 || (job?.status === 'running' || job?.status === 'queued')}
            className="w-full py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 disabled:opacity-40"
          >
            Re-screen {conflictIds.length} conflict records
          </button>
          <button
            onClick={() => runMutation.mutate(uncertainIds)}
            disabled={runMutation.isPending || uncertainIds.length === 0 || (job?.status === 'running' || job?.status === 'queued')}
            className="w-full py-2 bg-orange-400 text-white rounded-lg font-medium text-sm hover:bg-orange-500 disabled:opacity-40"
          >
            Re-screen {uncertainIds.length} agent-uncertain records
          </button>
        </div>

        {job && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700 capitalize">{job.status}</span>
              <span className="text-slate-500">{processed} / {job.total}</span>
            </div>
            <div className="bg-slate-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            {job.current_record_title && (
              <p className="text-sm text-slate-500 truncate">
                Current: {job.current_record_title}
              </p>
            )}
            {job.errors > 0 && (
              <p className="text-sm text-red-600">{job.errors} error(s): {job.error_message}</p>
            )}
            {job.status === 'done' && (
              <p className="text-sm text-green-600">
                Done! Screened {job.completed} records{job.errors > 0 ? ` with ${job.errors} error(s)` : ''}.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400">
        The agent screens records independently and does not see your decisions.
        Runs in the background — you can navigate away and return.
      </div>
    </div>
  )
}
