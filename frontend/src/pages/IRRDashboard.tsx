import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getIRR } from '../api/reviews'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const DECISIONS = ['Include', 'Exclude', 'Uncertain'] as const

function KappaGauge({ kappa }: { kappa: number }) {
  const pct = Math.max(0, Math.min(1, (kappa + 1) / 2)) * 100
  const colour = kappa >= 0.61 ? 'bg-green-500' : kappa >= 0.41 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="text-center">
      <div className="text-5xl font-bold text-slate-800">{kappa.toFixed(3)}</div>
      <div className="w-full bg-slate-200 rounded-full h-3 mt-3">
        <div className={`${colour} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function IRRDashboard() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const id = Number(reviewId)
  const [phase, setPhase] = useState<number | undefined>(undefined)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['irr', id, phase],
    queryFn: () => getIRR(id, phase),
  })

  const agreementChartData = data?.confusion_matrix
    ? DECISIONS.map(d => ({
        name: `H: ${d}`,
        Agree: data.confusion_matrix![d][d] ?? 0,
        Conflict: (DECISIONS.reduce((sum, a) => sum + (data.confusion_matrix![d][a] ?? 0), 0)) - (data.confusion_matrix![d][d] ?? 0),
      }))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">IRR Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            ↺ Refresh
          </button>
        <select
          className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          value={phase ?? ''}
          onChange={e => setPhase(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All phases</option>
          <option value={1}>Phase 1</option>
          <option value={2}>Phase 2</option>
          <option value={3}>Phase 3</option>
        </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-400">Loading…</p>
      ) : !data || data.kappa === null ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700">
          {data?.message ?? 'Not enough paired decisions yet. Screen records with both human and agent first.'}
        </div>
      ) : (
        <>
          {/* Kappa summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 col-span-2">
              <h2 className="text-sm font-medium text-slate-500 mb-3">Cohen's Kappa</h2>
              <KappaGauge kappa={data.kappa} />
              <p className="text-center text-slate-600 mt-2 font-medium">{data.kappa_interpretation}</p>
              {data.below_threshold && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700">
                  ⚠ κ &lt; 0.61 — Review criteria operationalisation with supervisor before proceeding.
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">% Agreement</p>
                <p className="text-3xl font-bold text-slate-800">{data.percent_agreement}%</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Paired decisions</p>
                <p className="text-3xl font-bold text-slate-800">{data.n_paired}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Conflicts</p>
                <p className="text-3xl font-bold text-slate-800">{data.n_conflicts}</p>
              </div>
            </div>
          </div>

          {/* Confusion matrix */}
          {data.confusion_matrix && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-medium text-slate-600 mb-4">Confusion Matrix (Human rows × Agent columns)</h2>
              <table className="text-sm w-auto">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-slate-500 font-medium">Human \ Agent</th>
                    {DECISIONS.map(d => <th key={d} className="px-4 py-2 text-slate-600 font-medium">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DECISIONS.map(human => (
                    <tr key={human} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-700">{human}</td>
                      {DECISIONS.map(agent => {
                        const count = data.confusion_matrix![human]?.[agent] ?? 0
                        const isAgree = human === agent
                        return (
                          <td key={agent} className={`px-4 py-2 text-center ${isAgree ? 'bg-green-50 font-bold text-green-700' : count > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                            {count}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Agreement bar chart */}
          {agreementChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-medium text-slate-600 mb-4">Agreement by Human Decision</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agreementChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Agree" fill="#22c55e" />
                  <Bar dataKey="Conflict" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
