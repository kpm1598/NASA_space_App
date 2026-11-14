import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import {
  CircleMarker, MapContainer, Marker, Popup, Rectangle, ScaleControl,
  TileLayer, useMap,
} from 'react-leaflet'
import { api } from '../services/api'

const PALETTE = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#facc15', '#fb7185', '#22d3ee', '#e879f9']
const FLAME_COUNT = 150

function clusterColor(id) {
  if (!id) return '#64748b'
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997
  return PALETTE[h % PALETTE.length]
}

// Fire radiative power tiers: the colour/size language of the map.
function frpTier(frp) {
  if (frp == null) return { label: 'intensity unknown', color: '#94a3b8' }
  if (frp < 5) return { label: 'Low intensity', color: '#facc15' }
  if (frp < 20) return { label: 'Moderate intensity', color: '#fb923c' }
  if (frp < 50) return { label: 'High intensity', color: '#f97316' }
  return { label: 'Extreme intensity', color: '#ef4444' }
}

function frpRadius(frp) {
  if (!frp) return 3.5
  return Math.min(11, 3 + Math.sqrt(frp))
}

function flameIcon(color, size) {
  return L.divIcon({
    className: 'flame-marker',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24">`
      + `<path d="M12 2.5c.8 3.2-2.4 4.6-2.4 7.1a2.4 2.4 0 0 0 4.8 0c0-.8-.4-1.6-.4-1.6s2.4 1.2 2.4 4A4.4 4.4 0 1 1 7.6 12C7.6 7.4 10.6 5.4 12 2.5Z" fill="${color}" stroke="#0b1020" stroke-width="0.8"/>`
      + `<path d="M12 12.4c.8.9 1.4 1.8 1.4 2.7a1.4 1.4 0 1 1-2.8 0c0-.9.6-1.8 1.4-2.7Z" fill="#fde68a"/>`
      + '</svg>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
    popupAnchor: [0, -size + 4],
  })
}

const BASEMAPS = {
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    labels: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  },
  streets: {
    label: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    labels: null,
  },
  dark: {
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    labels: null,
  },
}

function FitToData({ data, appliedArea }) {
  const map = useMap()
  useEffect(() => {
    if (!data) return
    if (appliedArea) {
      map.fitBounds(
        [[appliedArea.south, appliedArea.west], [appliedArea.north, appliedArea.east]],
        { padding: [28, 28] })
      return
    }
    if (data.observations.length) {
      const b = L.latLngBounds(data.observations.map((o) => [o.latitude, o.longitude]))
      if (b.isValid()) map.fitBounds(b, { padding: [28, 28] })
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function HotspotPopup({ o, color }) {
  const tier = frpTier(o.frp)
  return (
    <div style={{ minWidth: 190 }}>
      <span style={{
        background: color, color: '#0b1020', borderRadius: 6, padding: '1px 7px',
        fontWeight: 700, fontSize: 12,
      }}>{o.sensor}</span>{' '}
      <span style={{ fontSize: 12 }}>{o.satellite || ''}</span><br />
      <strong>{tier.label}</strong> — FRP {o.frp ?? '—'} MW<br />
      Detected: {o.observed_at} UTC<br />
      Confidence: {o.confidence_raw ?? '—'} (harmonized: {['low', 'nominal', 'high'][o.confidence_harmonized] ?? '—'})<br />
      Day/Night: {o.daynight || '—'}<br />
      Cluster: {o.cluster_id || 'isolated observation'}<br />
      Candidate cross-sensor link: {o.has_candidate_link ? 'yes' : 'no'}
    </div>
  )
}

export default function FireMap() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [showModis, setShowModis] = useState(true)
  const [showViirs, setShowViirs] = useState(true)
  const [viewMode, setViewMode] = useState('intensity') // intensity | sensor | cluster
  const [basemap, setBasemap] = useState('satellite')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [west, setWest] = useState('')
  const [south, setSouth] = useState('')
  const [east, setEast] = useState('')
  const [north, setNorth] = useState('')
  const [areaError, setAreaError] = useState('')
  const [appliedArea, setAppliedArea] = useState(null)

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
    setAppliedArea(Object.keys(area).length ? area : null)
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

  const pointColor = (o) => {
    if (viewMode === 'sensor') return o.sensor === 'MODIS' ? '#ef4444' : '#38bdf8'
    if (viewMode === 'cluster') return clusterColor(o.cluster_id)
    return frpTier(o.frp).color
  }

  // The strongest detections in view get real flame markers on top of the
  // glow layer, so the eye lands on the most intense burning first.
  const flames = useMemo(
    () => [...points].filter((o) => o.frp != null)
      .sort((a, b) => b.frp - a.frp).slice(0, FLAME_COUNT),
    [points])
  const flameIds = useMemo(() => new Set(flames.map((o) => o.id)), [flames])
  const maxFrp = flames.length ? flames[0].frp : null
  const base = BASEMAPS[basemap]

  const segmentBtn = (active) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-orange-600 font-medium text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fire Map — where the burning is</h2>
        <p className="text-sm text-slate-400">
          Real satellite imagery with every harmonized hotspot drawn as a glowing fire point.
          Bigger, brighter points mean stronger burning (higher fire radiative power, FRP);
          flame markers flag the {FLAME_COUNT} strongest detections in view. Click any point for its details.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Colour the map by</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setViewMode('intensity')} className={segmentBtn(viewMode === 'intensity')}>Fire intensity</button>
              <button onClick={() => setViewMode('sensor')} className={segmentBtn(viewMode === 'sensor')}>Sensor</button>
              <button onClick={() => setViewMode('cluster')} className={segmentBtn(viewMode === 'cluster')}>Cluster</button>
            </div>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-200">Base map</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BASEMAPS).map(([key, b]) => (
                <button key={key} onClick={() => setBasemap(key)} className={segmentBtn(basemap === key)}>{b.label}</button>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <p className="font-medium text-slate-300">Legend</p>
              {viewMode === 'intensity' && (
                <>
                  <p><span style={{ color: '#facc15' }}>●</span> Low — under 5 MW</p>
                  <p><span style={{ color: '#fb923c' }}>●</span> Moderate — 5 to 20 MW</p>
                  <p><span style={{ color: '#f97316' }}>●</span> High — 20 to 50 MW</p>
                  <p><span style={{ color: '#ef4444' }}>●</span> Extreme — over 50 MW, white-hot core</p>
                  <p className="text-slate-400">Point size also grows with FRP.</p>
                </>
              )}
              {viewMode === 'sensor' && (
                <>
                  <p><span className="text-red-400">●</span> MODIS (Terra/Aqua, ~1 km pixels)</p>
                  <p><span className="text-sky-400">●</span> VIIRS (Suomi NPP, 375 m pixels)</p>
                  <p className="text-slate-400">VIIRS sees many more, smaller hotspots — that difference is real, and it is preserved, not hidden.</p>
                </>
              )}
              {viewMode === 'cluster' && (
                <>
                  <p className="text-slate-300">Points sharing a colour belong to the same candidate activity cluster.</p>
                  <p><span className="text-slate-400">●</span> Grey points are isolated observations.</p>
                  <p className="text-slate-400">A cluster is a group of related detections — not one confirmed wildfire.</p>
                </>
              )}
              <p className="pt-1 text-slate-400">🔥 Flame = one of the {FLAME_COUNT} strongest detections currently in view.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
            <h3 className="mb-2 font-semibold text-slate-200">Filters</h3>
            <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={showModis} onChange={(e) => setShowModis(e.target.checked)} /> <span className="text-red-400">●</span> MODIS</label>
            <label className="mb-3 flex items-center gap-2"><input type="checkbox" checked={showViirs} onChange={(e) => setShowViirs(e.target.checked)} /> <span className="text-sky-400">●</span> VIIRS</label>
            <label className="mb-2 flex items-center justify-between gap-2 text-slate-400">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
            <label className="mb-3 flex items-center justify-between gap-2 text-slate-400">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
            <p className="mb-2 font-medium text-slate-300">Area of interest (lon/lat)</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between gap-1 text-slate-400">West <input type="number" step="0.1" value={west} onChange={(e) => setWest(e.target.value)} placeholder="80.5" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
              <label className="flex items-center justify-between gap-1 text-slate-400">East <input type="number" step="0.1" value={east} onChange={(e) => setEast(e.target.value)} placeholder="83.5" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
              <label className="flex items-center justify-between gap-1 text-slate-400">South <input type="number" step="0.1" value={south} onChange={(e) => setSouth(e.target.value)} placeholder="20.0" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
              <label className="flex items-center justify-between gap-1 text-slate-400">North <input type="number" step="0.1" value={north} onChange={(e) => setNorth(e.target.value)} placeholder="23.0" className="w-20 rounded bg-slate-800 px-2 py-1 text-slate-100" /></label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => { setWest('80.5'); setSouth('20'); setEast('83.5'); setNorth('23') }} className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700">Demo AOI</button>
              <button onClick={() => { setWest(''); setSouth(''); setEast(''); setNorth(''); setAreaError('') }} className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700">Clear area</button>
            </div>
            {areaError && <p className="mt-2 text-red-400">{areaError}</p>}
            <button onClick={load} className="mt-3 w-full rounded-lg bg-orange-600 px-3 py-2 font-medium text-white hover:bg-orange-500">Apply filters</button>
            <a href={api.observationsCsvUrl({ date_from: from, date_to: to, ...(areaParams() || {}), ...(showModis !== showViirs ? { sensor: showModis ? 'MODIS' : 'VIIRS' } : {}) })}
              className="mt-2 block rounded-lg bg-slate-800 px-3 py-2 text-center hover:bg-slate-700">
              Download matching hotspots (CSV)
            </a>
            {error && <p className="mt-2 text-red-400">{error}</p>}
          </div>
        </div>

        <div>
          {data && (
            <p className="mb-2 text-sm text-slate-400">
              Showing {points.length.toLocaleString('en-IN')} of {data.total_matching.toLocaleString('en-IN')} matching observations
              {maxFrp != null && <> · strongest in view: <strong className="text-orange-300">{maxFrp} MW</strong></>}
              {flames.length > 0 && <> · {flames.length} flame markers shown</>}
              {data.capped && <span className="text-amber-400"> · points are capped at {data.cap.toLocaleString('en-IN')} for browser performance — narrow the dates or area to see a period in full.</span>}
            </p>
          )}
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <MapContainer center={[21.5, 82.0]} zoom={7} preferCanvas style={{ height: '72vh', width: '100%' }}>
              <TileLayer key={basemap} url={base.url} attribution={base.attribution} />
              {base.labels && <TileLayer url={base.labels} attribution="© CARTO" opacity={0.85} />}
              <ScaleControl position="bottomleft" />
              <FitToData data={data} appliedArea={appliedArea} />
              {appliedArea && (
                <Rectangle
                  bounds={[[appliedArea.south, appliedArea.west], [appliedArea.north, appliedArea.east]]}
                  pathOptions={{ color: '#f97316', weight: 1.5, dashArray: '6 4', fillOpacity: 0.04 }}
                />
              )}
              {points.filter((o) => !flameIds.has(o.id)).map((o) => (
                <CircleMarker key={o.id} center={[o.latitude, o.longitude]} radius={frpRadius(o.frp)}
                  pathOptions={{
                    color: pointColor(o), fillColor: pointColor(o),
                    fillOpacity: viewMode === 'intensity' ? 0.55 : 0.7, weight: 0.4,
                  }}>
                  <Popup><HotspotPopup o={o} color={pointColor(o)} /></Popup>
                </CircleMarker>
              ))}
              {points.filter((o) => o.frp != null && o.frp >= 50).map((o) => (
                <CircleMarker key={`core-${o.id}`} center={[o.latitude, o.longitude]} radius={2}
                  pathOptions={{ color: '#fff7ed', fillColor: '#fff7ed', fillOpacity: 0.95, weight: 0 }} />
              ))}
              {flames.map((o) => (
                <Marker key={`flame-${o.id}`} position={[o.latitude, o.longitude]}
                  icon={flameIcon(pointColor(o), o.frp >= 50 ? 26 : 20)}>
                  <Popup><HotspotPopup o={o} color={pointColor(o)} /></Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Each point is one satellite-detected thermal anomaly (a hotspot), not a confirmed ground-truth wildfire.
            FRP (fire radiative power, MW) is the satellite's measurement of the fire's radiative energy — the map's
            size and brightness scale with it, so dense bright areas are where burning was most intense, not just most frequent.
          </p>
        </div>
      </div>
    </div>
  )
}
