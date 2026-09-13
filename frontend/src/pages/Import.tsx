import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importRIS, importCSV } from '../api/reviews'

export default function Import() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const id = Number(reviewId)
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [format, setFormat] = useState<'ris' | 'csv'>('ris')
  const [phase, setPhase] = useState(1)
  const [sourceType, setSourceType] = useState('database')
  const [result, setResult] = useState<{ imported: number; batch: string } | null>(null)

  const importMutation = useMutation({
    mutationFn: (file: File) =>
      format === 'ris'
        ? importRIS(id, file, phase, sourceType)
        : importCSV(id, file, phase, sourceType),
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['irr-summary', id] })
      if (fileRef.current) fileRef.current.value = ''
    },
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) importMutation.mutate(file)
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Import Records</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">File format</label>
            <select
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={format}
              onChange={e => setFormat(e.target.value as 'ris' | 'csv')}
            >
              <option value="ris">RIS (Zotero export)</option>
              <option value="csv">CSV (Covidence export)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Phase</label>
            <select
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              value={phase}
              onChange={e => setPhase(Number(e.target.value))}
            >
              <option value={1}>Phase 1 — Title &amp; Abstract</option>
              <option value={2}>Phase 2 — Full Text</option>
              <option value={3}>Phase 3 — Grey Literature</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Source type</label>
          <select
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            value={sourceType}
            onChange={e => setSourceType(e.target.value)}
          >
            <option value="database">Database (Medline, Embase, etc.)</option>
            <option value="grey_literature">Grey literature</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            File (.{format})
          </label>
          <input
            ref={fileRef}
            type="file"
            accept={format === 'ris' ? '.ris,.txt' : '.csv'}
            onChange={handleFile}
            disabled={importMutation.isPending}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-600 file:text-white file:text-sm hover:file:bg-blue-700"
          />
        </div>

        {importMutation.isPending && (
          <p className="text-sm text-blue-600">Importing…</p>
        )}
        {importMutation.isError && (
          <p className="text-sm text-red-600">
            Import failed: {(importMutation.error as Error).message}
          </p>
        )}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
            Imported <strong>{result.imported}</strong> records (batch: <code>{result.batch}</code>)
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <p>RIS: export from Zotero or any reference manager.</p>
        <p>CSV: export from Covidence — include Title, Abstract, Authors, Year columns.</p>
      </div>
    </div>
  )
}
