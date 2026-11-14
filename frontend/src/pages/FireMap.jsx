import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { api } from '../services/api'

const PALETTE = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#facc15', '#fb7185', '#22d3ee', '#e879f9']

function clusterColor(id) {
  if (!id) return '#64748b'
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997
  return PALETTE[h % PALETTE.length]
}

export default function FireMap() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [showModis, setShowModis] = useState(true)
  const [showViirs, setShowViirs] = useState(true)
  const [clusterView, setClusterView] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = () => {
    setError('')
    api.observations({ date_from: from, date_to: to, limit: 5000 })
      .then(setData)
      .catch(() => setError('Could not load observations — backend unreachable?'))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const points = useMemo(() => {
    if (!data) return []
    return data.observations.filter(
      (o) => (o.sensor === 'MODIS' ? showModis : showViirs))
  }, [data, showModis, showViirs])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showModis} onChange={(e) => setShowModis(e.target.checked)} /> <span className="text-red-400">●</span> MODIS</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showViirs} onChange={(e) => setShowViirs(e.target.checked)} /> <span className="text-sky-400">●</span> VIIRS</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={clusterView} onChange={(e) => setClusterView(e.target.checked)} /> Colour by cluster</label>
        <label className="flex items-center gap-2 text-slate-400">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
        <label className="flex items-center gap-2 text-slate-400">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
        <button onClick={load} className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700">Apply</button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {data && (
        <p className="text-sm text-slate-400">
          Showing {points.length.toLocaleString('en-IN')} of {data.total_matching.toLocaleString('en-IN')} matching observations.
          {data.capped && <span className="text-amber-400"> Rendered points are capped at {data.cap.toLocaleString('en-IN')} for browser performance — narrow the date range to see a specific period in full.</span>}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <MapContainer center={[21.5, 82.0]} zoom={7} preferCanvas style={{ height: '70vh', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors" />
          {points.map((o) => (
            <CircleMarker key={o.id} center={[o.latitude, o.longitude]} radius={3.5}
              pathOptions={{
                color: clusterView ? clusterColor(o.cluster_id) : (o.sensor === 'MODIS' ? '#ef4444' : '#38bdf8'),
                fillColor: clusterView ? clusterColor(o.cluster_id) : (o.sensor === 'MODIS' ? '#ef4444' : '#38bdf8'),
                fillOpacity: 0.75, weight: 0.5,
              }}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>{o.sensor}</strong> · {o.satellite || ''}<br />
                  {o.observed_at}<br />
                  FRP: {o.frp ?? '—'} MW<br />
                  Confidence: {o.confidence_raw ?? '—'} (harmonized: {['low', 'nominal', 'high'][o.confidence_harmonized] ?? '—'})<br />
                  Day/Night: {o.daynight || '—'}<br />
                  Cluster: {o.cluster_id || 'isolated observation'}<br />
                  Candidate cross-sensor link: {o.has_candidate_link ? 'yes' : 'no'}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="text-xs text-slate-500">
        Each point is one satellite-detected thermal anomaly (a hotspot), not a confirmed ground-truth wildfire.
        {clusterView && ' In cluster view, points sharing a colour belong to the same candidate cluster; grey points are isolated observations.'}
      </p>
    </div>
  )
}
