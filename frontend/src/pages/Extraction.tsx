import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listExtractions, getExtraction, saveExtraction,
  exportExtractionCSV, getContentUrl,
} from '../api/reviews'
import type { Extraction, WhoDimension } from '../api/types'

// ── Small primitives ──────────────────────────────────────────────────────────

function Badge({ label, colour }: { label: string; colour: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colour}`}>{label}</span>
  )
}

function SourceBadge({ phase }: { phase: number | null }) {
  if (phase === 3) return <Badge label="Grey lit" colour="bg-purple-100 text-purple-700" />
  return <Badge label="Academic" colour="bg-blue-100 text-blue-700" />
}

function ExtractionStatus({ extracted }: { extracted: boolean }) {
  if (extracted) return <Badge label="Done" colour="bg-green-100 text-green-700" />
  return <Badge label="Pending" colour="bg-slate-100 text-slate-500" />
}

// ── WHO dimension toggle ───────────────────────────────────────────────────────

const WHO_RATINGS = ['Yes', 'Partial', 'No'] as const
type WhoRating = typeof WHO_RATINGS[number]

function WhoDimensionField({
  label,
  value,
  onChange,
}: {
  label: string
  value: WhoDimension | null
  onChange: (v: WhoDimension) => void
}) {
  const rating = value?.rating ?? null
  const detail = value?.detail ?? ''

  const ratingColour = (r: WhoRating) => {
    if (r === 'Yes') return rating === r ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
    if (r === 'Partial') return rating === r ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
    return rating === r ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-600 w-36 shrink-0">{label}</span>
        <div className="flex gap-1">
          {WHO_RATINGS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => onChange({ rating: r, detail })}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${ratingColour(r)}`}
            >
              {r}
            </button>
          ))}
          {rating && (
            <button
              type="button"
              onClick={() => onChange({ rating: null, detail })}
              className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {rating && (
        <input
          className="w-full text-xs border border-slate-200 rounded px-2 py-1 ml-36"
          placeholder="Brief detail (optional)…"
          value={detail}
          onChange={e => onChange({ rating, detail: e.target.value })}
        />
      )}
    </div>
  )
}

// ── Chip list (barriers / enablers) ──────────────────────────────────────────

function ChipList({
  label,
  items,
  onChange,
}: {
  label: string
  items: string[] | null
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const list = items ?? []

  const add = () => {
    const t = draft.trim()
    if (t && !list.includes(t)) onChange([...list, t])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex flex-wrap gap-1 min-h-6">
        {list.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-500 leading-none"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          className="flex-1 text-xs border border-slate-200 rounded px-2 py-1"
          placeholder="Add item and press Enter…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button
          type="button"
          onClick={add}
          className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100 pb-1">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  const cls = 'w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-300 outline-none'
  return (
    <div className="space-y-0.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {textarea
        ? <textarea rows={3} className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  )
}

function Select({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div className="space-y-0.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <select
        className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-300 outline-none bg-white"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Empty form state ──────────────────────────────────────────────────────────

function emptyForm(): Partial<Extraction> {
  return {
    study_design: null, country: null, health_system_level: null,
    ai_system_name: null, ml_technique: null, clinical_application: null, deployment_status: null,
    patient_population: null, clinical_domain: null,
    infrastructure_context: null, data_governance_context: null,
    nasss_condition: null, nasss_technology: null, nasss_value_proposition: null,
    nasss_adopter_staff: null, nasss_adopter_patients: null, nasss_org_context: null,
    nasss_institutional: null,
    who_transparency: null, who_accountability: null, who_inclusiveness: null,
    who_non_maleficence: null, who_autonomy: null, who_sustainability: null,
    barriers_technology: null, barriers_workforce: null, barriers_organisational: null,
    barriers_equity: null, barriers_governance: null,
    enablers_technology: null, enablers_workforce: null, enablers_organisational: null,
    enablers_equity: null, enablers_governance: null,
    governance_equity_notes: null, extractor_notes: null,
  }
}

function mergeExtraction(ex: Extraction | null | undefined): Partial<Extraction> {
  if (!ex) return emptyForm()
  return { ...emptyForm(), ...ex }
}

// ── Document viewer ───────────────────────────────────────────────────────────

function DocViewer({ reviewId, recordId, hasFullText, isPdf }: { reviewId: number; recordId: number; hasFullText: boolean; isPdf: boolean }) {
  const [mode, setMode] = useState<'text' | 'pdf'>(isPdf ? 'pdf' : 'text')

  useEffect(() => {
    setMode(isPdf ? 'pdf' : 'text')
  }, [isPdf, recordId])
  const { data: content, isLoading } = useQuery({
    queryKey: ['content', reviewId, recordId],
    queryFn: async () => {
      const res = await fetch(getContentUrl(reviewId, recordId))
      if (!res.ok) return null
      return res.text()
    },
    enabled: hasFullText && mode === 'text',
  })

  if (!hasFullText) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        No full text available — extract from title/abstract only.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
        <button
          onClick={() => setMode('text')}
          className={`text-xs px-2 py-1 rounded ${mode === 'text' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          Text
        </button>
        <button
          onClick={() => setMode('pdf')}
          className={`text-xs px-2 py-1 rounded ${mode === 'pdf' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          PDF
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {mode === 'pdf' ? (
          <iframe
            src={`/api/reviews/${reviewId}/fulltext/${recordId}/pdf`}
            className="w-full h-full border-0"
            title="PDF viewer"
          />
        ) : isLoading ? (
          <div className="p-4 text-slate-400 text-xs">Loading…</div>
        ) : content ? (
          <pre className="p-4 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
        ) : (
          <div className="p-4 text-slate-400 text-xs">Could not load text content.</div>
        )}
      </div>
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────

function ExtractionList({ reviewId }: { reviewId: number }) {
  const navigate = useNavigate()
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['extractions', reviewId],
    queryFn: () => listExtractions(reviewId),
  })

  const done = records.filter(r => r.extracted).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Data Extraction</h1>
          <p className="text-sm text-slate-500 mt-1">
            {done} / {records.length} sources extracted
          </p>
        </div>
        <button
          onClick={() => exportExtractionCSV(reviewId)}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          Export CSV
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: records.length ? `${(done / records.length) * 100}%` : '0%' }}
        />
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Full text</th>
                <th className="px-4 py-2">Study design</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr
                  key={r.id}
                  className="hover:bg-blue-50 cursor-pointer"
                  onClick={() => navigate(`/review/${reviewId}/extraction/${r.id}`)}
                >
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">{r.external_id ?? r.id}</td>
                  <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{r.title ?? '—'}</td>
                  <td className="px-4 py-2"><SourceBadge phase={r.phase} /></td>
                  <td className="px-4 py-2 text-center">
                    {r.has_full_text
                      ? <span className="text-green-600 text-xs font-medium">✓</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{r.study_design ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{r.country ?? '—'}</td>
                  <td className="px-4 py-2">
                    <ExtractionStatus extracted={r.extracted} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Edit view (split pane) ────────────────────────────────────────────────────

function ExtractionForm({ reviewId, recordId }: { reviewId: number; recordId: number }) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: records = [] } = useQuery({
    queryKey: ['extractions', reviewId],
    queryFn: () => listExtractions(reviewId),
  })

  const { data: raw, isLoading } = useQuery({
    queryKey: ['extraction', reviewId, recordId],
    queryFn: () => getExtraction(reviewId, recordId),
  })

  const record = records.find(r => r.id === recordId)
  const [form, setForm] = useState<Partial<Extraction>>(() => mergeExtraction(raw ?? null))
  const [saved, setSaved] = useState(false)

  // Sync form when remote data loads
  const [synced, setSynced] = useState(false)
  if (!synced && !isLoading && raw !== undefined) {
    setForm(mergeExtraction(raw))
    setSynced(true)
  }

  const set = useCallback(<K extends keyof Extraction>(key: K, val: Extraction[K] | null) => {
    setSaved(false)
    setForm(f => ({ ...f, [key]: val }))
  }, [])

  const saveMut = useMutation({
    mutationFn: () => saveExtraction(reviewId, recordId, form),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['extractions', reviewId] })
      qc.invalidateQueries({ queryKey: ['extraction', reviewId, recordId] })
    },
  })

  // Prev / next navigation
  const currentIdx = records.findIndex(r => r.id === recordId)
  const prevId = currentIdx > 0 ? records[currentIdx - 1].id : null
  const nextId = currentIdx < records.length - 1 ? records[currentIdx + 1].id : null
  const isPdfFullText = record
    ? record.full_text_is_pdf ?? (record.has_full_text && record.phase !== 3)
    : false

  const str = (v: string | null | undefined) => v ?? ''

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 text-white text-sm shrink-0">
        <button onClick={() => navigate(`/review/${reviewId}/extraction`)} className="text-slate-400 hover:text-white text-xs">
          ← All sources
        </button>
        <span className="text-slate-500">|</span>
        <span className="font-medium truncate max-w-md">{record?.external_id ?? recordId} — {record?.title ?? '—'}</span>
        {record && <SourceBadge phase={record.phase} />}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-400 text-xs">{currentIdx + 1} / {records.length}</span>
          <button
            disabled={!prevId}
            onClick={() => prevId && navigate(`/review/${reviewId}/extraction/${prevId}`)}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-xs"
          >
            ← Prev
          </button>
          <button
            disabled={!nextId}
            onClick={() => {
              saveMut.mutate()
              nextId && navigate(`/review/${reviewId}/extraction/${nextId}`)
            }}
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-xs"
          >
            Save & Next →
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: document */}
        <div className="w-1/2 border-r border-slate-200 overflow-hidden">
          <DocViewer reviewId={reviewId} recordId={recordId} hasFullText={record?.has_full_text ?? false} isPdf={isPdfFullText} />
        </div>

        {/* Right: form */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Action bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-40"
            >
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-green-600 text-xs">Saved ✓</span>}
            {saveMut.isError && <span className="text-red-500 text-xs">Save failed</span>}
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

            {/* 1. Study characteristics */}
            <Section title="1 · Study characteristics">
              <Select
                label="Study design"
                value={str(form.study_design)}
                onChange={v => set('study_design', v || null)}
                options={['RCT', 'Cohort', 'Cross-sectional', 'Pre-post', 'Qualitative', 'Mixed-methods',
                  'Survey', 'Case study', 'Implementation report', 'Systematic review', 'Scoping review',
                  'Framework', 'Policy', 'White paper', 'Other']}
              />
              <Field label="Country / Countries" value={str(form.country)} onChange={v => set('country', v || null)} placeholder="e.g. Rwanda, India" />
              <Select
                label="Health system level"
                value={str(form.health_system_level)}
                onChange={v => set('health_system_level', v || null)}
                options={['Community', 'Primary care clinic', 'District hospital', 'National', 'Multi-level', 'Not specified']}
              />
            </Section>

            {/* 2. AI system */}
            <Section title="2 · AI system characteristics">
              <Field label="System name / description" value={str(form.ai_system_name)} onChange={v => set('ai_system_name', v || null)} placeholder="e.g. DeepDR-LLM, unnamed ML tool" />
              <Select
                label="ML technique"
                value={str(form.ml_technique)}
                onChange={v => set('ml_technique', v || null)}
                options={['Deep learning', 'CNN', 'NLP / LLM', 'Random forest', 'SVM',
                  'Gradient boosting', 'Neural network', 'Ensemble', 'Multiple', 'Not specified', 'Not applicable']}
              />
              <Field label="Clinical application" value={str(form.clinical_application)} onChange={v => set('clinical_application', v || null)} placeholder="What does it do?" textarea />
              <Select
                label="Deployment status"
                value={str(form.deployment_status)}
                onChange={v => set('deployment_status', v || null)}
                options={['Active / deployed', 'Piloting', 'Planned', 'Not implemented', 'Framework only']}
              />
            </Section>

            {/* 3. Primary care setting */}
            <Section title="3 · Primary care setting">
              <Field label="Patient population" value={str(form.patient_population)} onChange={v => set('patient_population', v || null)} placeholder="e.g. rural adults, pregnant women" />
              <Field label="Clinical domain" value={str(form.clinical_domain)} onChange={v => set('clinical_domain', v || null)} placeholder="e.g. diabetic retinopathy, maternal health" />
            </Section>

            {/* 4. LMIC context */}
            <Section title="4 · LMIC context">
              <Field label="Infrastructure context" value={str(form.infrastructure_context)} onChange={v => set('infrastructure_context', v || null)} placeholder="Connectivity, power, hardware limitations noted" textarea />
              <Field label="Data governance context" value={str(form.data_governance_context)} onChange={v => set('data_governance_context', v || null)} placeholder="Data laws, national AI policy, health system regulations" textarea />
            </Section>

            {/* 5. NASSS domains */}
            <Section title="5 · NASSS implementation domains (Greenhalgh et al., 2017)">
              <WhoDimensionField label="1 · Condition / illness" value={form.nasss_condition ?? null} onChange={v => set('nasss_condition', v)} />
              <WhoDimensionField label="2 · Technology" value={form.nasss_technology ?? null} onChange={v => set('nasss_technology', v)} />
              <WhoDimensionField label="3 · Value proposition" value={form.nasss_value_proposition ?? null} onChange={v => set('nasss_value_proposition', v)} />
              <WhoDimensionField label="4 · Adopter — staff" value={form.nasss_adopter_staff ?? null} onChange={v => set('nasss_adopter_staff', v)} />
              <WhoDimensionField label="5 · Adopter — patients" value={form.nasss_adopter_patients ?? null} onChange={v => set('nasss_adopter_patients', v)} />
              <WhoDimensionField label="6 · Org. context" value={form.nasss_org_context ?? null} onChange={v => set('nasss_org_context', v)} />
              <WhoDimensionField label="7 · Institutional / political" value={form.nasss_institutional ?? null} onChange={v => set('nasss_institutional', v)} />
            </Section>

            {/* 6. WHO dimensions */}
            <Section title="6 · Responsible AI dimensions (WHO framework)">
              <WhoDimensionField label="Transparency" value={form.who_transparency ?? null} onChange={v => set('who_transparency', v)} />
              <WhoDimensionField label="Accountability" value={form.who_accountability ?? null} onChange={v => set('who_accountability', v)} />
              <WhoDimensionField label="Inclusiveness / Equity" value={form.who_inclusiveness ?? null} onChange={v => set('who_inclusiveness', v)} />
              <WhoDimensionField label="Non-maleficence" value={form.who_non_maleficence ?? null} onChange={v => set('who_non_maleficence', v)} />
              <WhoDimensionField label="Autonomy" value={form.who_autonomy ?? null} onChange={v => set('who_autonomy', v)} />
              <WhoDimensionField label="Sustainability" value={form.who_sustainability ?? null} onChange={v => set('who_sustainability', v)} />
            </Section>

            {/* 7. Barriers */}
            <Section title="7 · Implementation barriers">
              <ChipList label="Technology barriers" items={form.barriers_technology ?? null} onChange={v => set('barriers_technology', v)} />
              <ChipList label="Workforce / adoption barriers" items={form.barriers_workforce ?? null} onChange={v => set('barriers_workforce', v)} />
              <ChipList label="Organisational / system barriers" items={form.barriers_organisational ?? null} onChange={v => set('barriers_organisational', v)} />
              <ChipList label="Equity / access barriers" items={form.barriers_equity ?? null} onChange={v => set('barriers_equity', v)} />
              <ChipList label="Governance / regulatory barriers" items={form.barriers_governance ?? null} onChange={v => set('barriers_governance', v)} />
            </Section>

            {/* 8. Enablers */}
            <Section title="8 · Implementation enablers">
              <ChipList label="Technology enablers" items={form.enablers_technology ?? null} onChange={v => set('enablers_technology', v)} />
              <ChipList label="Workforce enablers" items={form.enablers_workforce ?? null} onChange={v => set('enablers_workforce', v)} />
              <ChipList label="Organisational enablers" items={form.enablers_organisational ?? null} onChange={v => set('enablers_organisational', v)} />
              <ChipList label="Equity enablers" items={form.enablers_equity ?? null} onChange={v => set('enablers_equity', v)} />
              <ChipList label="Governance enablers" items={form.enablers_governance ?? null} onChange={v => set('enablers_governance', v)} />
            </Section>

            {/* 9. Governance & equity */}
            <Section title="9 · Governance & equity notes">
              <Field
                label="Key insights (data sovereignty, who was excluded, equity gaps)"
                value={str(form.governance_equity_notes)}
                onChange={v => set('governance_equity_notes', v || null)}
                textarea
              />
            </Section>

            {/* Extractor notes */}
            <Section title="Extractor notes">
              <Field
                label="Private notes (not exported)"
                value={str(form.extractor_notes)}
                onChange={v => set('extractor_notes', v || null)}
                textarea
              />
            </Section>

            <div className="pb-8" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default function Extraction() {
  const { reviewId, recordId } = useParams<{ reviewId: string; recordId?: string }>()
  const id = Number(reviewId)

  if (recordId) {
    return <ExtractionForm key={recordId} reviewId={id} recordId={Number(recordId)} />
  }
  return <ExtractionList reviewId={id} />
}
