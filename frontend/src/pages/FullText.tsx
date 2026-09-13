import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promoteToPhase2, linkZoteroPDFs, getPhase2Status, runAgent, getJobStatus, uploadRecordPDF } from '../api/reviews'

function errorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return error instanceof Error ? error.message : String(error)
}

function StatusBadge({ v }: { v: string | null }) {
  if (!v) return <span className="text-slate-400 text-xs">—</span>
  const c: Record<string, string> = {
    Include: 'bg-green-100 text-green-700',
    Exclude: 'bg-red-100 text-red-700',
    Uncertain: 'bg-amber-100 text-amber-700',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c[v] ?? 'bg-slate-100 text-slate-600'}`}>{v}</span>
}

function ManualPdfUploadButton({
  disabled,
  onUpload,
}: {
  disabled: boolean
  onUpload: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-40"
      >
        {disabled ? 'Uploading...' : 'Upload PDF'}
      </button>
    </>
  )
}

export default function FullText() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const id = Number(reviewId)
  const qc = useQueryClient()

  const [promoteResult, setPromoteResult] = useState<{ promoted: number } | null>(null)
  const [linkResult, setLinkResult] = useState<{
    linked: number; total_phase2: number; not_in_csv: string[]; file_missing: { external_id: string; path: string }[]
  } | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const { data: status = [], isLoading } = useQuery({
    queryKey: ['phase2status', id],
    queryFn: () => getPhase2Status(id),
  })

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'running' || s === 'queued' ? 2000 : false
    },
  })

  const promoteMut = useMutation({
    mutationFn: () => promoteToPhase2(id),
    onSuccess: (data) => {
      setPromoteResult(data)
      qc.invalidateQueries({ queryKey: ['phase2status', id] })
    },
  })

  const linkMut = useMutation({
    mutationFn: (file: File) => linkZoteroPDFs(id, file),
    onSuccess: (data) => {
      setLinkResult(data)
      qc.invalidateQueries({ queryKey: ['phase2status', id] })
    },
  })

  const agentMut = useMutation({
    mutationFn: () => runAgent(id, 2),
    onSuccess: (data) => {
      if (data.job_id) setJobId(data.job_id)
    },
  })

  const uploadMut = useMutation({
    mutationFn: ({ recordId, file }: { recordId: number; file: File }) => uploadRecordPDF(id, recordId, file),
    onMutate: () => setUploadError(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phase2status', id] })
    },
    onError: (error) => {
      setUploadError(errorMessage(error))
    },
  })

  const withPdf = status.filter(r => r.has_pdf).length
  const agentDone = status.filter(r => r.agent_decision && r.agent_phase === 2).length
  const humanDone = status.filter(r => r.human_decision_phase2).length
  const processed = job ? job.completed + job.errors : 0

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Phase 2 — Full Text Screening</h1>
        <p className="text-sm text-slate-500 mt-1">Follow the steps below to set up and run Phase 2.</p>
      </div>

      {/* Step 1: Promote */}
      <section className="order-1 bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="font-semibold text-slate-700">Step 1 — Promote Phase 1 includes to Phase 2</h2>
        <p className="text-sm text-slate-500">
          Moves all Phase 1 records with a final decision of <strong>Include</strong> (resolved or human) into the Phase 2 queue.
          Safe to run again — already-promoted records are skipped.
        </p>
        <button
          onClick={() => promoteMut.mutate()}
          disabled={promoteMut.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          {promoteMut.isPending ? 'Promoting…' : 'Promote Includes → Phase 2'}
        </button>
        {promoteResult && (
          <p className="text-sm text-green-700 font-medium">
            ✓ {promoteResult.promoted} record{promoteResult.promoted !== 1 ? 's' : ''} promoted.
          </p>
        )}
        {promoteMut.isError && (
          <p className="text-sm text-red-600">Error: {String((promoteMut.error as Error).message)}</p>
        )}
      </section>

      {/* Step 2: Link PDFs */}
      <section className="order-2 bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="font-semibold text-slate-700">Step 2 — Link Zotero PDFs</h2>
        <p className="text-sm text-slate-500">
          Export your Phase 2 library from Zotero as CSV (<strong>File → Export Library → CSV</strong>, with all fields).
          Upload that file here and PDFs will be linked automatically using the Covidence numbers.
        </p>
        <div className="flex gap-3 items-center">
          <input
            ref={csvRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) linkMut.mutate(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => csvRef.current?.click()}
            disabled={linkMut.isPending}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
          >
            {linkMut.isPending ? 'Linking…' : 'Upload Zotero CSV'}
          </button>
          <span className="text-sm text-slate-500">{withPdf} / {status.length} records have a PDF linked</span>
        </div>
        {linkResult && (
          <div className="text-sm space-y-1">
            <p className="text-green-700 font-medium">✓ {linkResult.linked} PDF{linkResult.linked !== 1 ? 's' : ''} linked out of {linkResult.total_phase2} Phase 2 records.</p>
            {linkResult.file_missing.length > 0 && (
              <p className="text-amber-700">⚠ {linkResult.file_missing.length} PDF path{linkResult.file_missing.length !== 1 ? 's' : ''} in CSV but file not found on disk.</p>
            )}
            {linkResult.not_in_csv.length > 0 && (
              <p className="text-slate-500">{linkResult.not_in_csv.length} Phase 2 record{linkResult.not_in_csv.length !== 1 ? 's' : ''} not found in CSV — may need manual PDF attachment.</p>
            )}
          </div>
        )}
        {linkMut.isError && (
          <p className="text-sm text-red-600">Error: {errorMessage(linkMut.error)}</p>
        )}
        {uploadError && (
          <p className="text-sm text-red-600">Manual upload error: {uploadError}</p>
        )}
      </section>

      {/* Step 4: Run Agent */}
      <section className="order-4 bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="font-semibold text-slate-700">Step 4 — Run AI screening</h2>
        <p className="text-sm text-slate-500">
          Screen all Phase 2 records with the AI. Records with a PDF linked will be screened using the full text;
          records without a PDF will be screened on title and abstract only (as a fallback).
        </p>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => agentMut.mutate()}
            disabled={agentMut.isPending || job?.status === 'running' || job?.status === 'queued'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40"
          >
            {agentMut.isPending ? 'Starting…' : 'Run AI Screening (Phase 2)'}
          </button>
          {job && (
            <div className="text-sm text-slate-600">
              <span className={`font-medium ${job.status === 'done' ? 'text-green-700' : job.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                {job.status.toUpperCase()}
              </span>
              {' · '}{processed}/{job.total} processed
              {job.errors > 0 && <span className="text-red-500"> · {job.errors} errors</span>}
              {job.current_record_title && (
                <span className="block max-w-md truncate text-slate-400">
                  Current: {job.current_record_title}
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400">AI screened: {agentDone} / {status.length} records</p>
      </section>

      {/* Step 3: Screen */}
      <section className="order-3 bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="font-semibold text-slate-700">Step 3 — Human screening</h2>
        <p className="text-sm text-slate-500">
          Review each record with the full PDF and make your Include / Exclude decision.
          The AI decision is shown alongside for comparison.
        </p>
        <div className="flex gap-3">
          <Link
            to={`/review/${id}/screening?phase=2`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Start Phase 2 Screening
          </Link>
          <span className="text-sm text-slate-500 self-center">Human screened: {humanDone} / {status.length}</span>
        </div>
      </section>

      {/* Status table */}
      {status.length > 0 && (
        <section className="order-5 space-y-3">
          <h2 className="font-semibold text-slate-700">Phase 2 Records ({status.length})</h2>
          {isLoading ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2 text-center">PDF</th>
                    <th className="px-4 py-2 text-center">Attach</th>
                    <th className="px-4 py-2 text-center">AI</th>
                    <th className="px-4 py-2 text-center">Human</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {status.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-400 font-mono text-xs">{r.external_id}</td>
                      <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{r.title ?? '—'}</td>
                      <td className="px-4 py-2 text-center">
                        {r.has_pdf
                          ? <span className="text-green-600 text-xs font-medium">✓</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {r.has_pdf ? (
                          <span className="text-slate-300 text-xs">—</span>
                        ) : (
                          <ManualPdfUploadButton
                            disabled={uploadMut.isPending}
                            onUpload={(file) => uploadMut.mutate({ recordId: r.id, file })}
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge v={r.agent_phase === 2 ? r.agent_decision : null} />
                      </td>
                      <td className="px-4 py-2 text-center"><StatusBadge v={r.human_decision_phase2} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
