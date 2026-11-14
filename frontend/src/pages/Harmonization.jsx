import { useEffect, useState } from 'react'
import { api } from '../services/api'

function SensorTable({ name, s }) {
  if (!s) return null
  const c = s.confidence_distribution
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="text-base font-semibold">{name}</h3>
      <dl className="mt-3 space-y-1.5 text-sm text-slate-300">
        <div className="flex justify-between"><dt>Observations</dt><dd>{s.count.toLocaleString('en-IN')}</dd></div>
        <div className="flex justify-between"><dt>Median FRP</dt><dd>{s.median_frp ?? '—'} MW</dd></div>
        <div className="flex justify-between"><dt>Confidence — low</dt><dd>{c.low.toLocaleString('en-IN')}</dd></div>
        <div className="flex justify-between"><dt>Confidence — nominal</dt><dd>{c.nominal.toLocaleString('en-IN')}</dd></div>
        <div className="flex justify-between"><dt>Confidence — high</dt><dd>{c.high.toLocaleString('en-IN')}</dd></div>
      </dl>
    </div>
  )
}

export default function Harmonization() {
  const [h, setH] = useState(null)
  const [example, setExample] = useState(null)

  useEffect(() => {
    api.harmonization().then((d) => {
      setH(d)
      if (d.example_observation_id) {
        api.observation(d.example_observation_id).then(setExample).catch(() => {})
      }
    }).catch(() => setH({ sensors: {} }))
  }, [])

  if (!h) return <p className="text-slate-400">Loading harmonization stats…</p>

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-relaxed text-slate-300">
        <h2 className="mb-2 text-lg font-semibold text-slate-100">How BLACKCAT harmonizes MODIS + VIIRS</h2>
        <p>
          MODIS (Terra/Aqua, ~1 km pixels) reports confidence as a percentage; VIIRS (Suomi NPP, 375 m
          pixels) reports it as a category (low / nominal / high). BLACKCAT maps both onto one ordinal
          scale — MODIS 0–29% → low, 30–79% → nominal, 80–100% → high; VIIRS l/n/h → low/nominal/high —
          while <strong>preserving every original field</strong> of every observation. Nothing is merged
          away or deleted: cross-sensor relationships are stored as <em>candidate links</em> (two
          observations within 1.5 km and 3 hours), and both originals remain in the database.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SensorTable name="MODIS (Terra + Aqua)" s={h.sensors?.MODIS} />
        <SensorTable name="VIIRS (Suomi NPP)" s={h.sensors?.VIIRS} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400">Candidate cross-sensor links</div>
          <div className="mt-1 text-3xl font-semibold">{(h.candidate_links ?? 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400">Mixed-sensor clusters</div>
          <div className="mt-1 text-3xl font-semibold">{(h.mixed_sensor_clusters ?? 0).toLocaleString('en-IN')}</div>
          <div className="mt-1 text-xs text-slate-500">Candidate clusters containing observations from both sensors — direct evidence the harmonized record works across instruments.</div>
        </div>
      </div>

      {example && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-3 text-base font-semibold">One real observation: original FIRMS fields vs unified record</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Original (as delivered by NASA FIRMS)</div>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(example.original, null, 1)}</pre>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Unified BLACKCAT record</div>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(example.unified, null, 1)}</pre>
            </div>
          </div>
          {example.candidate_links?.length > 0 && (
            <p className="mt-3 text-sm text-slate-300">
              This observation has {example.candidate_links.length} candidate cross-sensor link(s) — a
              possible co-detection by the other instrument, with both originals preserved.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
