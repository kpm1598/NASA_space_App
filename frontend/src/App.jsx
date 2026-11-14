import { useCallback, useEffect, useState } from 'react'
import { api } from './services/api'
import CalendarPage from './pages/CalendarPage'
import Dashboard from './pages/Dashboard'
import FireMap from './pages/FireMap'
import Harmonization from './pages/Harmonization'
import Intelligence from './pages/Intelligence'

const VIEWS = [
  ['dashboard', 'Dashboard'],
  ['map', 'Fire Map'],
  ['calendar', 'Burning Activity Calendar'],
  ['harmonization', 'Harmonization'],
  ['intelligence', 'Intelligence Center'],
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [backendDown, setBackendDown] = useState(false)

  const refresh = useCallback(() => {
    api.stats()
      .then((s) => { setStats(s); setBackendDown(false) })
      .catch(() => setBackendDown(true))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div>
            <div className="text-xl font-bold tracking-wide text-slate-50">
              BLACK<span className="text-orange-500">CAT</span>
            </div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">
              Multi-Satellite Fire Intelligence · MODIS + VIIRS Harmonization
            </div>
          </div>
          <nav className="ml-auto flex flex-wrap gap-1">
            {VIEWS.map(([key, label]) => (
              <button key={key} onClick={() => setView(key)}
                className={`rounded-lg px-3 py-2 text-sm ${view === key ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {backendDown && (
        <div className="border-b border-red-900 bg-red-950/80 px-4 py-3 text-center text-sm text-red-200">
          Backend not reachable at {api.base} — start it with{' '}
          <code className="rounded bg-slate-900 px-1">uvicorn app.main:app --port 8000</code>{' '}
          from the backend folder, then reload. No data is shown because no data was loaded — nothing here is simulated.
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6">
        {view === 'dashboard' && <Dashboard stats={stats} refresh={refresh} />}
        {view === 'map' && <FireMap />}
        {view === 'calendar' && <CalendarPage />}
        {view === 'harmonization' && <Harmonization />}
        {view === 'intelligence' && <Intelligence />}
      </main>

      <footer className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-500">
        Team BlackCat · NASA Space Apps Challenge 2026 · “Harmonization of MODIS and VIIRS Hot Spots” ·
        Data: NASA FIRMS · Hotspots are thermal anomalies, not confirmed wildfires
      </footer>
    </div>
  )
}
