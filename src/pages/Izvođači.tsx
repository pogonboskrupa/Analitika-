import { useState, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import {
  getYearRange, getAvailableYears, filterByDateRange,
  aggregateIzvođačSummary, formatNumber,
} from '@/lib/utils'
import type { DateRange, PrimkaRow } from '@/lib/types'
import { exportCsv } from '@/lib/exportCsv'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { cn } from '@/lib/utils'

type TabKey = 'pregled' | 'trend' | 'primaci' | 'odjeli' | 'sortimenti'

const PALETTE = [
  '#16a34a','#2563eb','#dc2626','#d97706','#7c3aed',
  '#0891b2','#be185d','#65a30d','#ea580c','#6366f1',
  '#0d9488','#9333ea',
]

const SORT_DEFS = [
  { label: 'FL četinari',        group: 'Četinari' as const, key: 'fl_c' as keyof PrimkaRow },
  { label: 'I kl. četinari',     group: 'Četinari' as const, key: 'i_c' as keyof PrimkaRow },
  { label: 'II kl. četinari',    group: 'Četinari' as const, key: 'ii_c' as keyof PrimkaRow },
  { label: 'III kl. četinari',   group: 'Četinari' as const, key: 'iii_c' as keyof PrimkaRow },
  { label: 'Rudničko drvo',      group: 'Četinari' as const, key: 'rd_c' as keyof PrimkaRow },
  { label: 'Celuloza duga',      group: 'Četinari' as const, key: 'cel_duga' as keyof PrimkaRow },
  { label: 'Celuloza cijepana',  group: 'Četinari' as const, key: 'cel_cijepana' as keyof PrimkaRow },
  { label: 'Škart',              group: 'Četinari' as const, key: 'skart' as keyof PrimkaRow },
  { label: 'FL lišćari',         group: 'Lišćari' as const,  key: 'fl_l' as keyof PrimkaRow },
  { label: 'I kl. lišćari',      group: 'Lišćari' as const,  key: 'i_l' as keyof PrimkaRow },
  { label: 'II kl. lišćari',     group: 'Lišćari' as const,  key: 'ii_l' as keyof PrimkaRow },
  { label: 'III kl. lišćari',    group: 'Lišćari' as const,  key: 'iii_l' as keyof PrimkaRow },
  { label: 'Ogrevno dugo',       group: 'Lišćari' as const,  key: 'ogr_dugi' as keyof PrimkaRow },
  { label: 'Ogrevno cijepano',   group: 'Lišćari' as const,  key: 'ogr_cijepani' as keyof PrimkaRow },
  { label: 'Gule',               group: 'Lišćari' as const,  key: 'gule' as keyof PrimkaRow },
]

// ── Aggregation helpers ───────────────────────────────────────────────────────
interface GroupRow { name: string; count: number; ukupno: number; cetinari: number; liscare: number }

function aggregateByKey(rows: PrimkaRow[], key: keyof PrimkaRow): GroupRow[] {
  const m = new Map<string, GroupRow>()
  for (const r of rows) {
    const k = String(r[key] || '—')
    const e = m.get(k)
    if (e) { e.count++; e.ukupno += r.ukupno; e.cetinari += r.sigma_cetinari; e.liscare += r.liscare }
    else m.set(k, { name: k, count: 1, ukupno: r.ukupno, cetinari: r.sigma_cetinari, liscare: r.liscare })
  }
  return Array.from(m.values()).sort((a, b) => b.ukupno - a.ukupno)
}

// Group: izvođač → list of (primac|odjel) rows, sorted by volume
function groupByIzvođač(rows: PrimkaRow[], subKey: 'primac' | 'odjel') {
  const m = new Map<string, Map<string, GroupRow>>()
  for (const r of rows) {
    const iz = r.izvođač || '—'
    const sub = String(r[subKey] || '—')
    if (!m.has(iz)) m.set(iz, new Map())
    const sub_m = m.get(iz)!
    const e = sub_m.get(sub)
    if (e) { e.count++; e.ukupno += r.ukupno; e.cetinari += r.sigma_cetinari; e.liscare += r.liscare }
    else sub_m.set(sub, { name: sub, count: 1, ukupno: r.ukupno, cetinari: r.sigma_cetinari, liscare: r.liscare })
  }
  // Sort izvođači by total volume
  const result: { izvođač: string; total: number; rows: GroupRow[] }[] = []
  for (const [iz, sub_m] of m) {
    const subRows = Array.from(sub_m.values()).sort((a, b) => b.ukupno - a.ukupno)
    const total = subRows.reduce((s, r) => s + r.ukupno, 0)
    result.push({ izvođač: iz, total, rows: subRows })
  }
  return result.sort((a, b) => b.total - a.total)
}

function aggregateIzvođačByMonth(rows: PrimkaRow[]) {
  const monthMap = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const d = r.datum
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const iz = r.izvođač || '—'
    if (!monthMap.has(key)) monthMap.set(key, new Map())
    const m = monthMap.get(key)!
    m.set(iz, (m.get(iz) ?? 0) + r.ukupno)
  }
  const months = Array.from(monthMap.keys()).sort()
  const ML = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
  const monthLabels = months.map(k => { const [y, mo] = k.split('-'); return `${ML[parseInt(mo)-1]} ${y}` })
  const totals = new Map<string, number>()
  for (const [, izMap] of monthMap) for (const [iz, v] of izMap) totals.set(iz, (totals.get(iz) ?? 0) + v)
  const topIz = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n]) => n)
  return {
    months: monthLabels,
    series: topIz.map(name => ({ name, data: months.map(k => monthMap.get(k)?.get(name) ?? 0) })),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Izvođači() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange]     = useState<DateRange>(() => getYearRange(new Date().getFullYear()))
  const availableYears = useMemo(() => getAvailableYears(primkaRows), [primkaRows])
  const [activeTab, setActiveTab] = useState<TabKey>('pregled')

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const summary  = useMemo(() => aggregateIzvođačSummary(filtered), [filtered])
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Izvođači radova</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {summary.length} izvođača · {formatNumber(summary.reduce((s, r) => s + r.totalUkupno, 0), 0)} m³ ukupno
        </p>
      </div>

      {/* Shared date filter + tabs in one row */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
        <DateRangePicker value={range} onChange={setRange} years={availableYears} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-1 -mt-1">
        {([
          { id: 'pregled',  label: 'Pregled' },
          { id: 'trend',    label: 'Trend po mjesecu' },
          { id: 'primaci',     label: 'Po primačima' },
          { id: 'odjeli',      label: 'Po odjelima' },
          { id: 'sortimenti',  label: 'Po sortimentima' },
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

      {activeTab === 'pregled'    && <PregledTab filtered={filtered} summary={summary} maxVol={maxVol} />}
      {activeTab === 'trend'      && <TrendTab trendData={trendData} />}
      {activeTab === 'primaci'    && <PrimaciTab filtered={filtered} />}
      {activeTab === 'odjeli'     && <OdjeliTab filtered={filtered} />}
      {activeTab === 'sortimenti' && <SortimentiTab filtered={filtered} />}
    </div>
  )
}

// ── Shared table components ───────────────────────────────────────────────────
function GroupTable({ rows, maxVol, linkPrefix }: {
  rows: GroupRow[]
  maxVol: number
  linkPrefix?: string
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <th className="px-3 py-2.5 text-left w-8">#</th>
          <th className="px-3 py-2.5 text-left">Naziv</th>
          <th className="px-3 py-2.5 text-right whitespace-nowrap">Primki</th>
          <th className="px-3 py-2.5 text-right whitespace-nowrap">Ukupno m³</th>
          <th className="px-3 py-2.5 text-right whitespace-nowrap">Četinari</th>
          <th className="px-3 py-2.5 text-right whitespace-nowrap">Lišćari</th>
          <th className="px-3 py-2.5 text-left w-28">Udio</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((r, i) => {
          const pct = maxVol > 0 ? r.ukupno / maxVol * 100 : 0
          const pctC = r.ukupno > 0 ? r.cetinari / r.ukupno * 100 : 0
          return (
            <tr key={r.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                {linkPrefix
                  ? <Link to={`${linkPrefix}${encodeURIComponent(r.name)}`}
                      className="hover:text-forest-700 dark:hover:text-forest-400 transition-colors">{r.name}</Link>
                  : r.name}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.count}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatNumber(r.ukupno, 0)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">{formatNumber(r.cetinari, 0)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatNumber(r.liscare, 0)}</td>
              <td className="px-3 py-2">
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: `linear-gradient(to right, #2563eb ${pctC}%, #d97706 ${pctC}%)` }} />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr className="bg-gray-100 dark:bg-gray-800 text-xs font-bold border-t-2 border-gray-300 dark:border-gray-600">
          <td colSpan={2} className="px-3 py-2.5 text-gray-600 dark:text-gray-300 uppercase tracking-wider">Ukupno</td>
          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{rows.reduce((s, r) => s + r.count, 0)}</td>
          <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-100">{formatNumber(rows.reduce((s, r) => s + r.ukupno, 0), 0)}</td>
          <td className="px-3 py-2.5 text-right tabular-nums text-blue-700 dark:text-blue-400">{formatNumber(rows.reduce((s, r) => s + r.cetinari, 0), 0)}</td>
          <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatNumber(rows.reduce((s, r) => s + r.liscare, 0), 0)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  )
}

// ── Pregled tab ───────────────────────────────────────────────────────────────
function PregledTab({ filtered, summary, maxVol }: {
  filtered: PrimkaRow[]
  summary: ReturnType<typeof aggregateIzvođačSummary>
  maxVol: number
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

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCsv('izvodjaci', [
          ['Rb.','Izvođač','Primki','Ukupno m3','Četinari m3','Lišćari m3'],
          ...sorted.map((r, i) => [i+1, r.izvođač, r.count, +r.totalUkupno.toFixed(2), +r.totalCetinari.toFixed(2), +r.totalLiscare.toFixed(2)]),
        ])}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Export CSV
        </button>
      </div>

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
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{r.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatNumber(r.totalUkupno, 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-700 dark:text-blue-400">{formatNumber(r.totalCetinari, 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatNumber(r.totalLiscare, 0)}</td>
                    <td className="px-4 py-2.5">
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(to right, #2563eb ${pctC}%, #d97706 ${pctC}%)` }} />
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

// ── Po primačima tab ──────────────────────────────────────────────────────────
function PrimaciTab({ filtered }: { filtered: PrimkaRow[] }) {
  const grouped = useMemo(() => groupByIzvođač(filtered, 'primac'), [filtered])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(grouped.map(g => g.izvođač)))

  function doExport() {
    const rows: (string|number)[][] = [['Izvođač','Primač','Primki','Ukupno m3','Četinari m3','Lišćari m3']]
    for (const g of grouped)
      for (const r of g.rows)
        rows.push([g.izvođač, r.name, r.count, +r.ukupno.toFixed(2), +r.cetinari.toFixed(2), +r.liscare.toFixed(2)])
    exportCsv('izvodjaci_primaci', rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {grouped.length} izvođača · klik na izvođača za razvijanje/skupljanje
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(new Set(grouped.map(g => g.izvođač)))}
            className="text-xs text-gray-400 hover:text-forest-600 dark:hover:text-forest-400 underline decoration-dotted">
            Razvij sve
          </button>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <button onClick={() => setExpanded(new Set())}
            className="text-xs text-gray-400 hover:text-forest-600 dark:hover:text-forest-400 underline decoration-dotted">
            Skupi sve
          </button>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <button onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {grouped.map((g, gi) => {
        const open = expanded.has(g.izvođač)
        const toggle = () => setExpanded(prev => {
          const next = new Set(prev)
          open ? next.delete(g.izvođač) : next.add(g.izvođač)
          return next
        })
        const maxPrimac = g.rows[0]?.ukupno ?? 1
        return (
          <div key={g.izvođač} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            {/* Izvođač header */}
            <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: PALETTE[gi % PALETTE.length] }}>
                  {gi + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-50">{g.izvođač}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.rows.length} primač{g.rows.length === 1 ? '' : 'a'} · {formatNumber(g.total, 0)} m³ ukupno
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(g.total, 0)} m³</p>
                </div>
                <svg className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {open && (
              <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
                <GroupTable rows={g.rows} maxVol={maxPrimac} linkPrefix="/primaci/" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Po odjelima tab ───────────────────────────────────────────────────────────
function OdjeliTab({ filtered }: { filtered: PrimkaRow[] }) {
  const grouped = useMemo(() => groupByIzvođač(filtered, 'odjel'), [filtered])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(grouped.map(g => g.izvođač)))

  // Also build a summary cross-tab: odjel → izvođači (who worked there)
  const odjelCross = useMemo(() => {
    const m = new Map<string, { izvođač: string; ukupno: number }[]>()
    for (const g of grouped) {
      for (const r of g.rows) {
        if (!m.has(r.name)) m.set(r.name, [])
        m.get(r.name)!.push({ izvođač: g.izvođač, ukupno: r.ukupno })
      }
    }
    return Array.from(m.entries())
      .map(([odjel, izArr]) => ({
        odjel,
        total: izArr.reduce((s, x) => s + x.ukupno, 0),
        izvođači: izArr.sort((a, b) => b.ukupno - a.ukupno),
      }))
      .sort((a, b) => b.total - a.total)
  }, [grouped])

  const [view, setView] = useState<'by-izvodjac' | 'by-odjel'>('by-izvodjac')

  function doExport() {
    const rows: (string|number)[][] = [['Izvođač','Odjel','Primki','Ukupno m3','Četinari m3','Lišćari m3']]
    for (const g of grouped)
      for (const r of g.rows)
        rows.push([g.izvođač, r.name, r.count, +r.ukupno.toFixed(2), +r.cetinari.toFixed(2), +r.liscare.toFixed(2)])
    exportCsv('izvodjaci_odjeli', rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button onClick={() => setView('by-izvodjac')}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              view === 'by-izvodjac' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
            Po izvođaču
          </button>
          <button onClick={() => setView('by-odjel')}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              view === 'by-odjel' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
            Po odjelu
          </button>
        </div>
        <div className="flex items-center gap-2">
          {view === 'by-izvodjac' && <>
            <button onClick={() => setExpanded(new Set(grouped.map(g => g.izvođač)))}
              className="text-xs text-gray-400 hover:text-forest-600 dark:hover:text-forest-400 underline decoration-dotted">Razvij sve</button>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <button onClick={() => setExpanded(new Set())}
              className="text-xs text-gray-400 hover:text-forest-600 dark:hover:text-forest-400 underline decoration-dotted">Skupi sve</button>
            <span className="text-gray-300 dark:text-gray-700">·</span>
          </>}
          <button onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {view === 'by-izvodjac' && grouped.map((g, gi) => {
        const open = expanded.has(g.izvođač)
        const toggle = () => setExpanded(prev => { const n = new Set(prev); open ? n.delete(g.izvođač) : n.add(g.izvođač); return n })
        const maxOdjel = g.rows[0]?.ukupno ?? 1
        return (
          <div key={g.izvođač} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: PALETTE[gi % PALETTE.length] }}>
                  {gi + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-50">{g.izvođač}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.rows.length} odjel{g.rows.length === 1 ? '' : 'a'} · {formatNumber(g.total, 0)} m³
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100 hidden sm:block">{formatNumber(g.total, 0)} m³</span>
                <svg className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {open && (
              <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
                <GroupTable rows={g.rows} maxVol={maxOdjel} />
              </div>
            )}
          </div>
        )
      })}

      {view === 'by-odjel' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Odjeli — koji izvođač je radio gdje</h3>
            <p className="text-xs text-gray-400 mt-0.5">Sortirano po ukupnom volumenu odjela</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2.5 text-left w-8">#</th>
                  <th className="px-3 py-2.5 text-left">Odjel</th>
                  <th className="px-3 py-2.5 text-right">Ukupno m³</th>
                  <th className="px-3 py-2.5 text-left">Izvođači (po volumenu)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {odjelCross.map((row, i) => (
                  <tr key={row.odjel} className={i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50 dark:bg-slate-800/30'}>
                    <td className="px-3 py-2.5 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.odjel}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{formatNumber(row.total, 0)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {row.izvođači.map((iz, j) => (
                          <span key={iz.izvođač}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: PALETTE[grouped.findIndex(g => g.izvođač === iz.izvođač) % PALETTE.length] }}>
                            {iz.izvođač}
                            <span className="opacity-80">· {formatNumber(iz.ukupno, 0)}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Po sortimentima tab ───────────────────────────────────────────────────────
function SortimentiTab({ filtered }: { filtered: PrimkaRow[] }) {
  // izvođači sorted by total volume desc
  const izvođači = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) {
      const iz = r.izvođač || '—'
      m.set(iz, (m.get(iz) ?? 0) + r.ukupno)
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n)
  }, [filtered])

  // pivot[sortKey][izvođač] = summed m³
  const pivot = useMemo(() => {
    const p: Record<string, Record<string, number>> = {}
    for (const d of SORT_DEFS) p[d.key as string] = {}
    for (const r of filtered) {
      const iz = r.izvođač || '—'
      for (const d of SORT_DEFS) {
        const v = (r[d.key] as number) || 0
        const k = d.key as string
        p[k][iz] = (p[k][iz] ?? 0) + v
      }
    }
    return p
  }, [filtered])

  function rowTotal(key: string) {
    return izvođači.reduce((s, iz) => s + (pivot[key]?.[iz] ?? 0), 0)
  }
  function groupSum(group: 'Četinari' | 'Lišćari', iz: string) {
    return SORT_DEFS.filter(d => d.group === group).reduce((s, d) => s + (pivot[d.key as string]?.[iz] ?? 0), 0)
  }
  function izvođačTotal(iz: string) {
    return SORT_DEFS.reduce((s, d) => s + (pivot[d.key as string]?.[iz] ?? 0), 0)
  }

  function doExport() {
    const rows: (string | number)[][] = [['Sortiment', 'Grupa', ...izvođači, 'Ukupno']]
    for (const d of SORT_DEFS) {
      const total = rowTotal(d.key as string)
      if (total === 0) continue
      rows.push([d.label, d.group, ...izvođači.map(iz => +(pivot[d.key as string]?.[iz] ?? 0).toFixed(2)), +total.toFixed(2)])
    }
    exportCsv('izvodjaci_sortimenti', rows)
  }

  if (filtered.length === 0) return (
    <p className="text-center py-16 text-sm text-gray-400">Nema podataka za odabrani period.</p>
  )

  const groups = ['Četinari', 'Lišćari'] as const

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={doExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 whitespace-nowrap min-w-40">Sortiment</th>
                {izvođači.map((iz, i) => (
                  <th key={iz} className="px-3 py-2.5 text-right font-medium whitespace-nowrap" style={{ color: PALETTE[i % PALETTE.length] }}>
                    {iz}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Ukupno</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => {
                const defs = SORT_DEFS.filter(d => d.group === group)
                const activeRows = defs.filter(d => rowTotal(d.key as string) > 0)
                if (activeRows.length === 0) return null
                const isC = group === 'Četinari'
                const groupColor = isC ? '#1d4ed8' : '#b45309'
                const groupBg = isC ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
                const subtotalBorder = isC ? 'border-blue-200 dark:border-blue-800' : 'border-amber-200 dark:border-amber-800'
                return (
                  <Fragment key={group}>
                    {/* Group header */}
                    <tr className={groupBg}>
                      <td colSpan={izvođači.length + 2} className="px-3 py-1.5 font-bold uppercase tracking-wider text-xs sticky left-0"
                        style={{ color: groupColor }}>
                        {group}
                      </td>
                    </tr>
                    {/* Sortiment rows */}
                    {activeRows.map((def, ri) => {
                      const total = rowTotal(def.key as string)
                      return (
                        <tr key={def.key as string} className={cn(
                          'divide-y-0 border-b border-gray-50 dark:border-gray-800/50',
                          ri % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50 dark:bg-slate-800/30'
                        )}>
                          <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-inherit whitespace-nowrap">{def.label}</td>
                          {izvođači.map(iz => {
                            const v = pivot[def.key as string]?.[iz] ?? 0
                            return (
                              <td key={iz} className="px-3 py-2 text-right tabular-nums">
                                {v > 0
                                  ? <span className="text-gray-800 dark:text-gray-200">{formatNumber(v, 0)}</span>
                                  : <span className="text-gray-300 dark:text-gray-700">—</span>}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatNumber(total, 0)}</td>
                        </tr>
                      )
                    })}
                    {/* Group subtotal */}
                    <tr className={cn('font-bold border-t-2', subtotalBorder, groupBg)} style={{ color: groupColor }}>
                      <td className="px-3 py-2 sticky left-0 bg-inherit whitespace-nowrap">Ukupno {group}</td>
                      {izvođači.map(iz => (
                        <td key={iz} className="px-3 py-2 text-right tabular-nums">{formatNumber(groupSum(group, iz), 0)}</td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(defs.reduce((s, d) => s + rowTotal(d.key as string), 0), 0)}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
              {/* Grand total */}
              <tr className="bg-gray-800 dark:bg-gray-700 text-white font-bold text-sm border-t-2 border-gray-600">
                <td className="px-3 py-3 sticky left-0 bg-gray-800 dark:bg-gray-700 whitespace-nowrap">UKUPNO</td>
                {izvođači.map(iz => (
                  <td key={iz} className="px-3 py-3 text-right tabular-nums">{formatNumber(izvođačTotal(iz), 0)}</td>
                ))}
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatNumber(izvođači.reduce((s, iz) => s + izvođačTotal(iz), 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Trend tab ─────────────────────────────────────────────────────────────────
function TrendTab({ trendData }: { trendData: ReturnType<typeof aggregateIzvođačByMonth> }) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [topN, setTopN] = useState(6)
  const visibleSeries = trendData.series.slice(0, topN)
  const chartData = trendData.months.map((label, mi) => {
    const obj: Record<string, string | number> = { name: label }
    for (const s of visibleSeries) obj[s.name] = +(s.data[mi] ?? 0).toFixed(2)
    return obj
  })

  function doExport() {
    exportCsv('trend_po_izvodjacima', [
      ['Mjesec', ...visibleSeries.map(s => s.name)],
      ...trendData.months.map((label, mi) => [label, ...visibleSeries.map(s => +(s.data[mi] ?? 0).toFixed(2))]),
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['bar','line'] as const).map(t => (
            <button key={t} onClick={() => setChartType(t)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                chartType === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
              {t === 'bar' ? 'Stupci' : 'Linije'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[3,6,10].map(n => (
            <button key={n} onClick={() => setTopN(n)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                topN === n ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
              Top {n}
            </button>
          ))}
        </div>
        <button onClick={doExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sječa po izvođaču — mjesečni trend</h3>
          <p className="text-xs text-gray-400 mt-0.5">Top {topN} izvođača · sve godine · m³</p>
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
              {visibleSeries.map((s, i) => <Bar key={s.name} dataKey={s.name} stackId="a" fill={PALETTE[i % PALETTE.length]} maxBarSize={40} />)}
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
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly table */}
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
                  <th key={s.name} className="px-3 py-2.5 text-right font-medium whitespace-nowrap" style={{ color: PALETTE[i % PALETTE.length] }}>{s.name}</th>
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
                        <td key={s.name} className="px-3 py-2 text-right tabular-nums" style={{ color: v > 0 ? PALETTE[i % PALETTE.length] : undefined }}>
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
                  <td key={s.name} className="px-3 py-2.5 text-right tabular-nums">{formatNumber(s.data.reduce((a, b) => a + b, 0), 0)}</td>
                ))}
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(visibleSeries.reduce((s, sr) => s + sr.data.reduce((a, b) => a + b, 0), 0), 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
