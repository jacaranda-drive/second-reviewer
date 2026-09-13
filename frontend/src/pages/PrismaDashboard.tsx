import { useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface PrismaStats {
  records_identified: number
  imported: number
  duplicates_removed: number
  deduped: number
  phase1: {
    total: number
    human_include: number
    human_exclude: number
    human_uncertain: number
    human_screened: number
    agent_include: number
    agent_exclude: number
    agent_uncertain: number
    agent_screened: number
    exclusion_reasons: Record<string, number>
  }
  phase2: {
    total: number
    human_include: number
    human_exclude: number
  }
}

const getPrismaStats = (reviewId: number, identified: number, dupes: number) =>
  api.get<PrismaStats>(`/reviews/${reviewId}/prisma/stats`, {
    params: { records_identified: identified, duplicates_removed: dupes },
  }).then(r => r.data)

// ── SVG layout constants ──────────────────────────────────────────────────────
const W = 1000
const H = 820
const BOX_W = 200
const BOX_H = 56
const CX = 560  // offset right to leave room for left-side exclusion box

function box(x: number, y: number, w: number, h: number, fill: string, label: string, sub: string, onClick?: () => void) {
  return (
    <g key={label} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke="#64748b" strokeWidth={1.2} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 8 : 0)} textAnchor="middle" fontSize={12} fontWeight={600} fill="#1e293b">{label}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" fontSize={11} fill="#475569">{sub}</text>}
    </g>
  )
}

function arrow(x1: number, y1: number, x2: number, y2: number) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1.5}
      markerEnd="url(#arrowhead)" />
  )
}

function fmt(n: number) { return n.toLocaleString() }

export default function PrismaDashboard() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const id = Number(reviewId)

  const [identified, setIdentified] = useState(0)
  const [dupes, setDupes] = useState(0)
  const [identifiedInput, setIdentifiedInput] = useState('')
  const [dupesInput, setDupesInput] = useState('')
  const [activeBox, setActiveBox] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['prisma-stats', id, identified, dupes],
    queryFn: () => getPrismaStats(id, identified, dupes),
    refetchInterval: 30_000,
  })

  const toggle = useCallback((key: string) => {
    setActiveBox(prev => prev === key ? null : key)
  }, [])

  const downloadSVG = () => {
    if (!svgRef.current) return
    const blob = new Blob([svgRef.current.outerHTML], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'prisma_flow.svg'
    a.click()
  }

  const downloadHTML = () => {
    if (!data || !svgRef.current) return
    const p1 = data.phase1
    const svgContent = svgRef.current.outerHTML
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>PRISMA-ScR Flow Diagram</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; color: #1e293b; }
  h1 { font-size: 1.25rem; }
  h2 { font-size: 1rem; color: #475569; font-weight: normal; margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 24px; font-size: 0.875rem; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  .ts { color: #94a3b8; font-size: 0.75rem; margin-top: 8px; }
</style></head><body>
<h1>PRISMA-ScR Flow Diagram</h1>
<h2>Implementing Responsible AI in LMIC Primary Care — Title &amp; Abstract Screening</h2>
${svgContent}
<table>
  <tr><th>Stage</th><th>Count</th><th>Notes</th></tr>
  <tr><td>Records identified (databases)</td><td>${fmt(data.records_identified)}</td><td>Pre-deduplication</td></tr>
  <tr><td>Duplicates removed</td><td>${fmt(data.duplicates_removed)}</td><td>Via Covidence</td></tr>
  <tr><td>Records screened (T/A)</td><td>${fmt(p1.total)}</td><td>Human + AI review</td></tr>
  <tr><td>Human: Excluded at T/A</td><td>${fmt(p1.human_exclude)}</td><td>See breakdown below</td></tr>
  <tr><td>Human: Included at T/A</td><td>${fmt(p1.human_include)}</td><td>Advancing to full-text</td></tr>
  <tr><td>Agent: Uncertain</td><td>${fmt(p1.agent_uncertain)}</td><td>Pending human review</td></tr>
  <tr><td>Full-text screened</td><td>${fmt(data.phase2.total)}</td><td></td></tr>
  <tr><td>Studies included</td><td>${fmt(data.phase2.human_include)}</td><td>Final inclusion</td></tr>
</table>
<p class="ts">Generated: ${new Date().toLocaleString()}</p>
</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'prisma_flow.html'
    a.click()
  }

  if (!data) return <div className="text-slate-400">Loading PRISMA data…</div>

  const p1 = data.phase1
  const p2 = data.phase2

  // ── box positions ─────────────────────────────────────────────────────────
  const bw = BOX_W
  const bh = BOX_H
  const y0 = 30,  y1 = 130, y2 = 230, y3 = 340, y4 = 450, y5 = 560, y6 = 680, y7 = 760

  const humanX = CX - bw - 20
  const agentX = CX + 20

  const detailPanels: Record<string, { title: string; rows: [string, string | number][] }> = {
    identified: {
      title: 'Records identified',
      rows: [['Total identified', fmt(data.records_identified)], ['Source', 'Multiple databases']],
    },
    imported: {
      title: 'After deduplication',
      rows: [['Imported', fmt(data.imported)], ['Duplicates removed', fmt(data.duplicates_removed)], ['Remaining', fmt(data.deduped)]],
    },
    human: {
      title: 'Human T/A Screening',
      rows: [['Include', fmt(p1.human_include)], ['Exclude', fmt(p1.human_exclude)], ['Uncertain', fmt(p1.human_uncertain)], ['Screened', fmt(p1.human_screened)], ['Total', fmt(p1.total)]],
    },
    agent: {
      title: 'Agent T/A Screening',
      rows: [['Include', fmt(p1.agent_include)], ['Exclude', fmt(p1.agent_exclude)], ['Uncertain (review pool)', fmt(p1.agent_uncertain)], ['Screened', fmt(p1.agent_screened)]],
    },
    exclusions: {
      title: 'Human exclusion reasons',
      rows: Object.entries(p1.exclusion_reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmt(v)]),
    },
    fulltext: {
      title: 'Full-Text Screening',
      rows: [['Screened', fmt(p2.total)], ['Include', fmt(p2.human_include)], ['Exclude', fmt(p2.human_exclude)]],
    },
  }

  const activePanel = activeBox ? detailPanels[activeBox] : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">PRISMA-ScR Flow Diagram</h1>
        <span className="text-xs text-slate-400">
          Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()} · auto-refreshes every 30s
        </span>
      </div>

      {/* Config row */}
      <div className="flex gap-4 items-end bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Records identified (pre-dedup)</label>
          <input
            type="number" min={0}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-36"
            placeholder="e.g. 1882"
            value={identifiedInput}
            onChange={e => setIdentifiedInput(e.target.value)}
            onBlur={() => setIdentified(Number(identifiedInput) || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Duplicates removed</label>
          <input
            type="number" min={0}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-36"
            placeholder="e.g. 661"
            value={dupesInput}
            onChange={e => setDupesInput(e.target.value)}
            onBlur={() => setDupes(Number(dupesInput) || 0)}
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={downloadSVG}
            className="px-4 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-100">
            Download SVG
          </button>
          <button onClick={downloadHTML}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Download HTML
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* SVG diagram */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Row 0: Identified */}
            {identified > 0 && <>
              {box(CX - bw / 2, y0, bw, bh, '#f1f5f9', 'Records identified', `n = ${fmt(data.records_identified)}`, () => toggle('identified'))}
              {arrow(CX, y0 + bh, CX, y1)}
            </>}

            {/* Row 1: Imported / deduped */}
            {box(CX - bw / 2, y1, bw, bh, '#f1f5f9',
              identified > 0 ? 'After deduplication' : 'Records imported',
              `n = ${fmt(data.deduped)}${dupes > 0 ? ` (−${fmt(data.duplicates_removed)} dupes)` : ''}`,
              () => toggle('imported'))}
            {arrow(CX, y1 + bh, CX, y2 + bh / 2)}

            {/* Split arrow to human + agent */}
            <line x1={CX} y1={y2 + bh / 2} x2={humanX + bw / 2} y2={y2 + bh / 2} stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={CX} y1={y2 + bh / 2} x2={agentX + bw / 2} y2={y2 + bh / 2} stroke="#94a3b8" strokeWidth={1.5} />
            {arrow(humanX + bw / 2, y2 + bh / 2, humanX + bw / 2, y3)}
            {arrow(agentX + bw / 2, y2 + bh / 2, agentX + bw / 2, y3)}

            {/* Row 2: Labels */}
            <text x={humanX + bw / 2} y={y2 + bh / 2 - 8} textAnchor="middle" fontSize={11} fill="#475569" fontWeight={600}>Human reviewer</text>
            <text x={agentX + bw / 2} y={y2 + bh / 2 - 8} textAnchor="middle" fontSize={11} fill="#475569" fontWeight={600}>AI agent (independent)</text>

            {/* Row 3: Decisions */}
            {box(humanX, y3, bw, bh, '#dcfce7', `Include: ${fmt(p1.human_include)}`, `Exclude: ${fmt(p1.human_exclude)}`, () => toggle('human'))}
            {box(agentX, y3, bw, bh, '#dbeafe', `Include: ${fmt(p1.agent_include)}`, `Exclude: ${fmt(p1.agent_exclude)}`, () => toggle('agent'))}

            {/* Uncertain boxes */}
            {arrow(agentX + bw / 2, y3 + bh, agentX + bw / 2, y4)}
            {box(agentX, y4, bw, bh, '#fef3c7', `Uncertain: ${fmt(p1.agent_uncertain)}`, 'Human review pool', () => toggle('agent'))}

            {/* Exclusion reasons off human */}
            {arrow(humanX, y3 + bh / 2, humanX - 120, y3 + bh / 2)}
            {box(humanX - 120 - bw, y3, bw, bh, '#fee2e2', `Excluded: ${fmt(p1.human_exclude)}`, 'See reasons →', () => toggle('exclusions'))}

            {/* Merge arrows to full-text */}
            {arrow(humanX + bw / 2, y3 + bh, humanX + bw / 2, y5 + bh / 2)}
            <line x1={humanX + bw / 2} y1={y5 + bh / 2} x2={CX} y2={y5 + bh / 2} stroke="#94a3b8" strokeWidth={1.5} />
            {arrow(agentX + bw / 2, y4 + bh, agentX + bw / 2, y5 + bh / 2)}
            <line x1={agentX + bw / 2} y1={y5 + bh / 2} x2={CX} y2={y5 + bh / 2} stroke="#94a3b8" strokeWidth={1.5} />
            {arrow(CX, y5 + bh / 2, CX, y5)}

            {/* Row 5: Full-text */}
            {box(CX - bw / 2, y5, bw, bh, '#f1f5f9',
              'Full-Text Review',
              p2.total > 0 ? `n = ${fmt(p2.total)}` : 'Pending',
              () => toggle('fulltext'))}

            {p2.total > 0 && <>
              {/* FT exclusions */}
              {arrow(CX - bw / 2, y5 + bh / 2, CX - bw / 2 - 120, y5 + bh / 2)}
              {box(CX - bw / 2 - 120 - bw, y5, bw, bh, '#fee2e2', `Excluded: ${fmt(p2.human_exclude)}`, 'Full-text review')}
              {arrow(CX, y5 + bh, CX, y6)}
              {box(CX - bw / 2, y6, bw, bh, '#dcfce7', 'Studies included', `n = ${fmt(p2.human_include)}`)}
            </>}

            {p2.total === 0 && <>
              {arrow(CX, y5 + bh, CX, y6)}
              {box(CX - bw / 2, y6, bw, bh, '#f1f5f9', 'Studies included', 'Pending full-text review')}
            </>}

            {/* Click hint */}
            <text x={W - 8} y={H - 8} textAnchor="end" fontSize={9} fill="#cbd5e1">Click boxes for details</text>
          </svg>
        </div>

        {/* Right panel */}
        <div className="w-72 space-y-4 shrink-0">
          {/* Summary stats */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Summary</h3>
            {[
              ['Identified', fmt(data.records_identified || data.deduped)],
              ['After dedup', fmt(data.deduped)],
              ['Human: Include', fmt(p1.human_include)],
              ['Human: Exclude', fmt(p1.human_exclude)],
              ['Agent: Include', fmt(p1.agent_include)],
              ['Agent: Exclude', fmt(p1.agent_exclude)],
              ['Agent: Uncertain', fmt(p1.agent_uncertain)],
              ['Full-text', fmt(p2.total)],
              ['Final included', fmt(p2.human_include)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="font-medium text-slate-800">{value}</span>
              </div>
            ))}
          </div>

          {/* Exclusion reasons */}
          {Object.keys(p1.exclusion_reasons).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Exclusion reasons (human)</h3>
              {Object.entries(p1.exclusion_reasons)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <div key={reason} className="text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-600 truncate pr-2" title={reason}>{reason}</span>
                      <span className="font-medium text-slate-800 shrink-0">{fmt(count)}</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-red-400 h-1.5 rounded-full"
                        style={{ width: `${Math.round((count / p1.human_exclude) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Active detail panel */}
          {activePanel && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-amber-800">{activePanel.title}</h3>
                <button onClick={() => setActiveBox(null)} className="text-amber-400 hover:text-amber-600 text-xs">✕</button>
              </div>
              {activePanel.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-amber-700">{k}</span>
                  <span className="font-medium text-amber-900">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
