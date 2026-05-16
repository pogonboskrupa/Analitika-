import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import {
  getQuickSelectRange, filterByDateRange,
  aggregateIzvođačSummary, aggregatePeriodTotals,
  formatNumber,
} from '@/lib/utils'
import type { DateRange, PrimkaRow } from '@/lib/types'
import { exportCsv } from '@/lib/exportCsv'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { cn } from '@/lib/utils'

type TabKey = 'pregled' | 'trend'

// Stable palette for up to 12 izvođači
const PALETTE = [
  '#16a34a','#2563eb','#dc2626','#d97706','#7c3aed',
  '#0891b2','#be185d','#65a30d','#ea580c','#6366f1',
  '#0d9488','#9333ea',
]

// Aggregate monthly sječa per izvođač
function aggregateIzvođačByMonth(rows: PrimkaRow[]): {
  months: string[]
  series: { name: string; data: number[] }[]
} {
  // Build set of months sorted
  const monthMap = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const d = r.datum
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const izvođač = r.izvođač || '—'
    if (!monthMap.has(key)) monthMap.set(key, new Map())
    const m = monthMap.get(key)!
    m.set(izvođač, (m.get(izvođač) ?? 0) + r.ukupno)
  }

  const months = Array.from(monthMap.keys()).sort()
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
  const monthLabels = months.map(k => {
    const [y, mo] = k.split('-')
    return `${MONTH_LABELS[parseInt(mo) - 1]} ${y}`
  })

  // Get all izvođači sorted by total volume (top 10)
  const totals = new Map<string, number>()
  for (const [, izMap] of monthMap) {
    for (const [iz, v] of izMap) totals.set(iz, (totals.get(iz) ?? 0) + v)
  }
  const topIzvođači = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name)

  const series = topIzvođači.map(name => ({
    name,
    data: months.map(k => monthMap.get(k)?.get(name) ?? 0),
  }))

  return { months: monthLabels, series }
}

export default function Izvođači() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))
  const [activeTab, setActiveTab] = useState<TabKey>('pregled')

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const summary = useMemo(() => aggregateIzvođačSummary(filtered), [filtered])

  // For trend: use all primkaRows (not date-filtered) so we always see full history
  const trendData = useMemo(() => aggregateIzvođačByMonth(primkaRows), [primkaRows])

  const maxVol = summary[0]?.totalUkupno ?? 1

  if (error) return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
      <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju podataka</h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
      <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline">Pokušaj ponovo</button>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Izvođači radova</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {summary.length} izvođača · {formatNumber(summary.reduce((s, r) => s + r.totalUkupno, 0), 0)} m³ ukupno
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-1">
        {([
          { id: 'pregled', label: 'Pregled' },
          { id: 'trend',   label: 'Trend po mjesecu' },
        ] as const).map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === id
                ? 'border-forest-600 text-forest-700 dark:text-forest-400 dark:border-forest-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            )}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'pregled' && (
        <PregledTab
          filtered={filtered}
          summary={summary}
          maxVol={maxVol}
          range={range}
          setRange={setRange}
          loading={loading}
        />
      )}

      {activeTab === 'trend' && (
        <TrendTab trendData={trendData} />
      )}
    </div>
  )
}

// ── Pregled tab ───────────────────────────────────────────────────────────────
function PregledTab({
  filtered, summary, maxVol, range, setRange, loading,
}: {
  filtered: PrimkaRow[]
  summary: ReturnType<typeof aggregateIzvođačSummary>
  maxVol: number
  range: DateRange
  setRange: (r: DateRange) => void
  loading: boolean
}) {
  const [sort, setSort] = useState<'ukupno' | 'cetinari' | 'liscare' | 'count'>('ukupno')
  const [asc, setAsc] = useState(false)

  const sorted = useMemo(() => [...summary].sort((a, b) => {
    const va = sort === 'ukupno' ? a.totalUkupno : sort === 'cetinari' ? a.totalCetinari : sort === 'liscare' ? a.totalLiscare : a.count
    const vb = sort === 'ukupno' ? b.totalUkupno : sort === 'cetinari' ? b.totalCetinari : sort === 'liscare' ? b.totalLiscare : b.count
    return asc ? va - vb : vb - va
  }), [summary, sort, asc])

  function th(col: typeof sort, label: string) {
    return (
      <th onClick={() => { if (sort === col) setAsc(p => !p); else { setSort(col); setAsc(false) } }}
        className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 whitespace-nowrap">
        <span className="flex items-center justify-end gap-1">
          {label} {sort === col ? (asc ? '↑' : '↓') : <span className="opacity-30">↕</span>}
        </span>
      </th>
    )
  }

  function doExport() {
    exportCsv('izvodjaci', [
      ['Rb.', 'Izvođač', 'Primki', 'Ukupno m3', 'Četinari m3', 'Lišćari m3', '% Četinari'],
      ...sorted.map((r, i) => [
        i + 1, r.izvođač, r.count,
        +r.totalUkupno.toFixed(2), +r.totalCetinari.toFixed(2), +r.totalLiscare.toFixed(2),
        r.totalUkupno > 0 ? +(r.totalCetinari / r.totalUkupno * 100).toFixed(1) : 0,
      ]),
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
        <button onClick={doExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* KPI mini-cards: top 3 */}
      {sorted.slice(0, 3).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sorted.slice(0, 3).map((r, i) => (
            <Link key={r.izvođač} to={`/radilista/izvođač/${encodeURIComponent(r.izvođač)}`}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 font-medium">
                  {r.totalUkupno > 0 ? (r.totalCetinari / r.totalUkupno * 100).toFixed(0) : 0}% Č
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 group-hover:text-forest-700 dark:group-hover:text-forest-400 transition-colors truncate">{r.izvođač}</p>
              <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-50 mt-1">{formatNumber(r.totalUkupno, 0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">m³ · {r.count} primki</p>
              <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-forest-500" style={{ width: `${r.totalUkupno / maxVol * 100}%` }} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Full table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Izvođač</th>
                {th('count',    'Primki')}
                {th('ukupno',   'Ukupno m³')}
                {th('cetinari', 'Četinari m³')}
                {th('liscare',  'Lišćari m³')}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-36">Udio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((r, i) => {
                const pct = r.totalUkupno / maxVol * 100
                const pctC = r.totalUkupno > 0 ? r.totalCetinari / r.totalUkupno * 100 : 0
                return (
                  <tr key={r.izvođač} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/radilista/izvođač/${encodeURIComponent(r.izvođač)}`}
                        className="font-semibold text-gray-900 dark:text-gray-100 hover:text-forest-700 dark:hover:text-forest-400 transition-colors">
                        {r.izvođač}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatNumber(r.totalUkupno, 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-700 dark:text-blue-400">{formatNumber(r.totalCetinari, 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatNumber(r.totalLiscare, 0)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: `linear-gradient(to right, #2563eb ${pctC}%, #d97706 ${pctC}%)` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-10 text-right tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-800 dark:bg-gray-700 text-white text-xs font-bold">
                <td colSpan={2} className="px-4 py-3 uppercase tracking-wider">Ukupno</td>
                <td className="px-4 py-3 text-right tabular-nums">{filtered.length}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(summary.reduce((s, r) => s + r.totalUkupno, 0), 0)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(summary.reduce((s, r) => s + r.totalCetinari, 0), 0)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(summary.reduce((s, r) => s + r.totalLiscare, 0), 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Trend tab ─────────────────────────────────────────────────────────────────
function TrendTab({
  trendData,
}: {
  trendData: ReturnType<typeof aggregateIzvođačByMonth>
}) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [topN, setTopN] = useState(6)

  const visibleSeries = trendData.series.slice(0, topN)

  // Build chart data: [{name: 'Jan 2025', 'IzvodjacA': 123, ...}]
  const chartData = trendData.months.map((label, mi) => {
    const obj: Record<string, string | number> = { name: label }
    for (const s of visibleSeries) obj[s.name] = +(s.data[mi] ?? 0).toFixed(2)
    return obj
  })

  function doExport() {
    const headers = ['Mjesec', ...visibleSeries.map(s => s.name)]
    const rows = trendData.months.map((label, mi) => [
      label,
      ...visibleSeries.map(s => +(s.data[mi] ?? 0).toFixed(2)),
    ])
    exportCsv('trend_po_izvodjacima', [headers, ...rows])
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['bar', 'line'] as const).map(t => (
            <button key={t} onClick={() => setChartType(t)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                chartType === t
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}>
              {t === 'bar' ? 'Stupci' : 'Linije'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[3, 6, 10].map(n => (
            <button key={n} onClick={() => setTopN(n)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                topN === n
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}>
              Top {n}
            </button>
          ))}
        </div>

        <button onClick={doExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sječa po izvođaču — mjesečni trend</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Top {topN} izvođača po ukupnom volumenu · sve godine · m³
          </p>
        </div>

        {chartData.length === 0 ? (
          <p className="text-center py-16 text-sm text-gray-400">Nema podataka.</p>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(v: number) => [formatNumber(v, 0) + ' m³']} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              {visibleSeries.map((s, i) => (
                <Bar key={s.name} dataKey={s.name} stackId="a" fill={PALETTE[i % PALETTE.length]} maxBarSize={40} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(v: number) => [formatNumber(v, 0) + ' m³']} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              {visibleSeries.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name}
                  stroke={PALETTE[i % PALETTE.length]} strokeWidth={2}
                  dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly totals table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tabela — sječa po izvođaču i mjesecu (m³)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Mjesec</th>
                {visibleSeries.map((s, i) => (
                  <th key={s.name} className="px-3 py-2.5 text-right font-medium whitespace-nowrap"
                    style={{ color: PALETTE[i % PALETTE.length] }}>
                    {s.name}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Ukupno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {trendData.months.map((label, mi) => {
                const rowTotal = visibleSeries.reduce((s, sr) => s + (sr.data[mi] ?? 0), 0)
                return (
                  <tr key={label} className={mi % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50 dark:bg-slate-800/30'}>
                    <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{label}</td>
                    {visibleSeries.map((s, i) => {
                      const v = s.data[mi] ?? 0
                      return (
                        <td key={s.name} className="px-3 py-2 text-right tabular-nums"
                          style={{ color: v > 0 ? PALETTE[i % PALETTE.length] : undefined }}>
                          {v > 0 ? formatNumber(v, 0) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100">
                      {rowTotal > 0 ? formatNumber(rowTotal, 0) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-800 dark:bg-gray-700 text-white font-bold">
                <td className="px-3 py-2.5 uppercase tracking-wider text-xs">Ukupno</td>
                {visibleSeries.map(s => (
                  <td key={s.name} className="px-3 py-2.5 text-right tabular-nums">
                    {formatNumber(s.data.reduce((a, b) => a + b, 0), 0)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(
                    visibleSeries.reduce((s, sr) => s + sr.data.reduce((a, b) => a + b, 0), 0),
                    0
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
