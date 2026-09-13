import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, NavLink, useParams } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Import from './pages/Import'
import Screening from './pages/Screening'
import RunAgent from './pages/RunAgent'
import Compare from './pages/Compare'
import Conflicts from './pages/Conflicts'
import IRRDashboard from './pages/IRRDashboard'
import Export from './pages/Export'
import PrismaDashboard from './pages/PrismaDashboard'
import FullText from './pages/FullText'
import Extraction from './pages/Extraction'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 300_000 } },
})

function Nav() {
  const { reviewId } = useParams<{ reviewId: string }>()
  if (!reviewId) return null
  const id = reviewId

  const links = [
    { to: `/review/${id}`, label: 'Dashboard', end: true },
    { to: `/review/${id}/import`, label: 'Import' },
    { to: `/review/${id}/screening`, label: 'P1 Screen' },
    { to: `/review/${id}/fulltext`, label: 'P2 Full Text' },
    { to: `/review/${id}/run-agent`, label: 'Run Agent' },
    { to: `/review/${id}/screening?phase=3`, label: 'P3 Screen' },
    { to: `/review/${id}/run-agent?phase=3`, label: 'P3 Agent' },
    { to: `/review/${id}/compare`, label: 'Compare' },
    { to: `/review/${id}/conflicts`, label: 'Conflicts' },
    { to: `/review/${id}/irr`, label: 'IRR' },
    { to: `/review/${id}/export`, label: 'Export' },
    { to: `/review/${id}/prisma`, label: 'PRISMA' },
    { to: `/review/${id}/extraction`, label: 'Extract' },
  ]

  return (
    <nav className="relative z-10 bg-slate-800 text-white px-4 py-2 flex gap-1 flex-wrap text-sm">
      {links.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded transition-colors ${isActive ? 'bg-blue-600' : 'hover:bg-slate-700'}`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}

function ReviewLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="import" element={<Import />} />
          <Route path="screening" element={<Screening />} />
          <Route path="run-agent" element={<RunAgent />} />
          <Route path="compare" element={<Compare />} />
          <Route path="conflicts" element={<Conflicts />} />
          <Route path="irr" element={<IRRDashboard />} />
          <Route path="export" element={<Export />} />
          <Route path="prisma" element={<PrismaDashboard />} />
          <Route path="fulltext" element={<FullText />} />
          <Route path="extraction" element={<Extraction />} />
          <Route path="extraction/:recordId" element={<Extraction />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/review/:reviewId/*" element={<ReviewLayout />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
