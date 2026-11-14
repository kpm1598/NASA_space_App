import { useEffect, useState } from 'react'
import { api } from '../services/api'

function Card({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-50">
        {value == null ? '—' : Number(value).toLocaleString('en-IN')}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export default function Dashboard({ stats, refresh }) {
  const [insights, setInsights] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.insights().then((d) => setInsights(d.insights)).catch(() => {})
  }, [stats])

  const load = async () => {
    setBusy(true); setMsg('')
    try {
      const r = await api.ingestSample()
      setMsg(`Ingested ${r.ingested.toLocaleString('en-IN')} observations from ${r.files?.length || 0} sample file(s); ${r.links} candidate links, ${r.clusters} clusters, ${r.anomalies} anomalies computed.`)
      refresh()
    } catch {
      setMsg('Ingest failed — is the backend running?')
    } finally { setBusy(false) }
  }

  if (!stats) return <p className="text-slate-400">Loading dashboard…</p>
  const archived = (stats.provenance || '').startsWith('Archived FIRMS data')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${archived ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'}`}>
          {archived ? 'Archived FIRMS data' : 'Sample data'}
        </span>
        <span className="text-sm text-slate-400">
          {stats.date_from ? `${stats.date_from} → ${stats.date_to}` : 'No data loaded yet'}
        </span>
        <button onClick={load} disabled={busy}
          className="ml-auto rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50">
          {busy ? 'Ingesting…' : 'Load bundled FIRMS dataset'}
        </button>
        <a href={api.reportUrl} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
          Download report (CSV)
        </a>
      </div>
      {msg && <p className="text-sm text-slate-300">{msg}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Total observations" value={stats.total_observations} />
        <Card label="MODIS observations" value={stats.modis} sub="Terra + Aqua, ~1 km pixels" />
        <Card label="VIIRS observations" value={stats.viirs} sub="Suomi NPP, 375 m pixels" />
        <Card label="Candidate clusters" value={stats.clusters} sub="Groups of related observations — not confirmed wildfires" />
        <Card label="Mixed-sensor clusters" value={stats.mixed_sensor_clusters} sub="Clusters seen by both MODIS and VIIRS" />
        <Card label="Candidate cross-sensor links" value={stats.candidate_links} sub="Within 1.5 km and 3 hours" />
        <Card label="Anomalies flagged" value={stats.anomalies} sub="Unusual grid-cell days — not fires, not predictions" />
        <Card label="Isolated observations" value={stats.isolated_observations} sub="Not part of any candidate cluster" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Fire Intelligence Insights</h2>
        {insights.length === 0
          ? <p className="text-sm text-slate-400">No insights yet — load the dataset to compute them from real statistics.</p>
          : <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
              {insights.map((s, i) => <li key={i}>{s}</li>)}
            </ul>}
        <p className="mt-4 text-xs text-slate-500">
          Every number above is computed from the loaded database. Satellite hotspots are detected
          thermal anomalies, not confirmed ground-truth wildfires.
        </p>
      </div>

      <details className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <summary className="cursor-pointer text-sm font-medium text-slate-200">Data provenance (full note)</summary>
        <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{stats.provenance}</pre>
      </details>
    </div>
  )
}
