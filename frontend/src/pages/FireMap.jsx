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
  const [west, setWest] = useState('')
  const [south, setSouth] = useState('')
  const [east, setEast] = useState('')
  const [north, setNorth] = useState('')
  const [areaError, setAreaError] = useState('')

  const areaParams = () => {
    // Area of interest: all four bounds or none. Returns null when the
    // input is incomplete/invalid (caller shows the message).
    const vals = [west, south, east, north]
    if (vals.every((v) => v === '')) return {}
    if (vals.some((v) => v === '' || Number.isNaN(Number(v)))) return null
    const [w, s, e, n] = vals.map(Number)
    if (!(w < e && s < n)) return null
    return { west: w, south: s, east: e, north: n }
  }

  const load = () => {
    setError('')
    const area = areaParams()
    if (area === null) {
      setAreaError('Enter all four area bounds as numbers, with west < east and south < north — or clear all four for the full dataset area.')
      return
    }
    setAreaError('')
    api.observations({ date_from: from, date_to: to, limit: 5000, ...area })
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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-400">Area of interest (lon/lat bounds):</span>
        <label className="flex items-center gap-1 text-slate-400">West <input type="number" step="0.1" value={west} onChange={(e) => setWest(e.target.value)} placeholder="80.5" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
        <label className="flex items-center gap-1 text-slate-400">South <input type="number" step="0.1" value={south} onChange={(e) => setSouth(e.target.value)} placeholder="20.0" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
        <label className="flex items-center gap-1 text-slate-400">East <input type="number" step="0.1" value={east} onChange={(e) => setEast(e.target.value)} placeholder="83.5" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
        <label className="flex items-center gap-1 text-slate-400">North <input type="number" step="0.1" value={north} onChange={(e) => setNorth(e.target.value)} placeholder="23.0" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
        <button onClick={() => { setWest(''); setSouth(''); setEast(''); setNorth(''); setAreaError('') }} className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700">Clear area</button>
        <a href={api.observationsCsvUrl({ date_from: from, date_to: to, ...(areaParams() || {}), ...(showModis !== showViirs ? { sensor: showModis ? 'MODIS' : 'VIIRS' } : {}) })}
          className="rounded-lg bg-orange-600 px-3 py-1.5 font-medium text-white hover:bg-orange-500">
          Download matching hotspots (CSV)
        </a>
        <span className="text-xs text-slate-500">Leave blank for the whole loaded dataset. Demo AOI: lon 80.5–83.5, lat 20–23. The CSV download follows the same date, sensor and area filters.</span>
      </div>
      {areaError && <p className="text-sm text-red-400">{areaError}</p>}
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
