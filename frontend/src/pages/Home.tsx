import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getReviews, createReview, getConfig } from '../api/reviews'
import type { Review } from '../api/types'

export default function Home() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [osf_url, setOsfUrl] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data: reviews = [], isLoading } = useQuery({ queryKey: ['reviews'], queryFn: getReviews })
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig })

  const create = useMutation({
    mutationFn: () => createReview({ name, description, osf_url }),
    onSuccess: (review: Review) => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      navigate(`/review/${review.id}`)
    },
  })

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">AI Second Reviewer</h1>
        <p className="text-slate-500 mb-1 text-sm">
          Oxford MGHL Dissertation, 2026
        </p>
        {config && (
          <p className="text-xs text-slate-400 mb-8">
            Active LLM: <span className="font-mono">{config.llm_provider} / {config.llm_model}</span>
          </p>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-700">Reviews</h2>
            <button
              onClick={() => setShowForm(v => !v)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              + New Review
            </button>
          </div>

          {showForm && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <input
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Review name *"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <input
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="OSF registration URL (optional)"
                value={osf_url}
                onChange={e => setOsfUrl(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  disabled={!name || create.isPending}
                  onClick={() => create.mutate()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-40"
                >
                  {create.isPending ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : reviews.length === 0 ? (
            <p className="text-slate-400 text-sm">No reviews yet. Create one above.</p>
          ) : (
            <ul className="space-y-2">
              {reviews.map(r => (
                <li key={r.id}>
                  <button
                    onClick={() => navigate(`/review/${r.id}`)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-slate-800">{r.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString()} ·{' '}
                      {r.llm_provider}/{r.llm_model}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
