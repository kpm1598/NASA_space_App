import { useEffect, useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/api'

function heatColor(v, max) {
  if (!v) return '#111827'
  const t = v / max
  if (t < 0.15) return '#7c2d12'
  if (t < 0.35) return '#9a3412'
  if (t < 0.6) return '#c2410c'
  if (t < 0.85) return '#ea580c'
  return '#f97316'
}

export default function CalendarPage() {
  const [days, setDays] = useState(null)
  useEffect(() => { api.calendar().then((d) => setDays(d.days)).catch(() => setDays([])) }, [])

  const weeks = useMemo(() => {
    if (!days || days.length === 0) return []
    const byDate = new Map(days.map((d) => [d.date, d]))
    const start = new Date(days[0].date + 'T00:00:00Z')
    start.setUTCDate(start.getUTCDate() - start.getUTCDay()) // back to Sunday
    const end = new Date(days[days.length - 1].date + 'T00:00:00Z')
    const cols = []
    const cur = new Date(start)
    while (cur <= end) {
      const col = []
      for (let i = 0; i < 7; i++) {
        const key = cur.toISOString().slice(0, 10)
        col.push({ date: key, day: byDate.get(key) || null })
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
      cols.push(col)
    }
    return cols
  }, [days])

  if (days === null) return <p className="text-slate-400">Loading calendar…</p>
  if (days.length === 0) return <p className="text-slate-400">No data loaded yet — ingest the dataset from the Dashboard first.</p>
  const max = Math.max(...days.map((d) => d.total))

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="mb-1 text-lg font-semibold">Burning Activity Calendar</h2>
        <p className="mb-4 text-sm text-slate-400">
          One cell per day, coloured by total hotspot observations (MODIS + VIIRS harmonized).
          Peak day: {days.reduce((a, b) => (b.total > a.total ? b : a)).date} with{' '}
          {max.toLocaleString('en-IN')} observations.
        </p>
        <div className="flex gap-[3px] overflow-x-auto pb-2">
          {weeks.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell, ri) => (
                <div key={ri} title={cell.day ? `${cell.date}: ${cell.day.total} observations (MODIS ${cell.day.modis}, VIIRS ${cell.day.viirs})` : cell.date}
                  className="h-3.5 w-3.5 rounded-[3px]"
                  style={{ backgroundColor: cell.day ? heatColor(cell.day.total, max) : 'transparent' }} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          Less <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: '#7c2d12' }} />
          <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: '#c2410c' }} />
          <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: '#f97316' }} /> More
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="mb-4 text-lg font-semibold">Daily observations by sensor</h2>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={days}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
            <Legend />
            <Bar dataKey="viirs" stackId="a" fill="#38bdf8" name="VIIRS" />
            <Bar dataKey="modis" stackId="a" fill="#ef4444" name="MODIS" />
            <Line type="monotone" dataKey="total" stroke="#f97316" dot={false} name="Total" />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-3 text-xs text-slate-500">
          VIIRS (375 m) detects many more, smaller thermal anomalies than MODIS (~1 km) over the same
          area and period. BLACKCAT preserves that sensor difference instead of pretending the two
          datasets are identical.
        </p>
      </div>
    </div>
  )
}
