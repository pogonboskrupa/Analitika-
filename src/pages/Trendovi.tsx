import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { PrintButton } from '@/components/PrintButton'
import { StatsCard } from '@/components/StatsCard'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import {
  getQuickSelectRange, filterByDateRange,
  aggregateDailyTotals, aggregateOtpremaDailyTotals,
  getTotalUkupno, formatNumber,
  aggregatePeriodTotals, aggregateSortimentiByPeriod,
} from '@/lib/utils'
import type { DateRange, PeriodSortimenti } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

type PeriodView = 'sedmicno' | 'mjesecno'
type DataSource = 'sjeca' | 'otprema'
type SortKey = 'trupciC' | 'trupciL' | 'celDuga' | 'celCijepana' | 'ogrDugi' | 'ogrCijepani' | 'gule' | 'skart'

const SORT_COLORS: Record<SortKey, string> = {
  trupciC: '#1d4ed8', trupciL: '#0284c7',
  celDuga: '#7c3aed', celCijepana: '#a855f7',
  ogrDugi: '#c2410c', ogrCijepani: '#ea580c', gule: '#fb923c',
  skart: '#9ca3af',
}
const SORT_LABELS: Record<SortKey, string> = {
  trupciC: 'Trupci Č', trupciL: 'Trupci L',
  celDuga: 'Cel. duga', celCijepana: 'Cel. cijepana',
  ogrDugi: 'Ogr. dugi', ogrCijepani: 'Ogr. cijepani', gule: 'Gule',
  skart: 'Skart',
}
const ALL_SORT_KEYS: SortKey[] = [
  'trupciC', 'trupciL', 'celDuga', 'celCijepana',
  'ogrDugi', 'ogrCijepani', 'gule', 'skart',
]

export default function Trendovi() {
  const { primkaRows, otpremaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))
  const [periodView, setPeriodView] = useState<PeriodView>('mjesecno')
  const [dataSource, setDataSource] = useState<DataSource>('sjeca')

  const filteredPrimka = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const filteredOtprema = useMemo(() => filterByDateRange(otpremaRows, range), [otpremaRows, range])

  const totalPrimka = getTotalUkupno(filteredPrimka)
  const totalOtprema = useMemo(() => filteredOtprema.reduce((s, r) => s + r.ukupno, 0), [filteredOtprema])
  const balance = totalPrimka - totalOtprema

  const primkaDailyData = useMemo(() => aggregateDailyTotals(filteredPrimka), [filteredPrimka])
  const otpremaDailyData = useMemo(() => aggregateOtpremaDailyTotals(filteredOtprema), [filteredOtprema])

  const view: 'week' | 'month' = periodView === 'sedmicno' ? 'week' : 'month'
  const N = periodView === 'sedmicno' ? 16 : 18

  const primkaByPeriod = useMemo(() => aggregatePeriodTotals(primkaRows, view), [primkaRows, view])
  const otpremaByPeriod = useMemo(() => aggregatePeriodTotals(otpremaRows, view), [otpremaRows, view])

  const periodCompareData = useMemo(() => {
    const allKeys = new Set([...primkaByPeriod.map(p => p.sortKey), ...otpremaByPeriod.map(p => p.sortKey)])
    const pm = new Map(primkaByPeriod.map(p => [p.sortKey, p]))
    const om = new Map(otpremaByPeriod.map(p => [p.sortKey, p]))
    return Array.from(allKeys).sort().map(k => ({
      name: (pm.get(k) ?? om.get(k))!.label,
      sjeca: pm.get(k)?.ukupno ?? 0,
      otprema: om.get(k)?.ukupno ?? 0,
    }))
  }, [primkaByPeriod, otpremaByPeriod])

  const primkaSortByPeriod = useMemo(() => aggregateSortimentiByPeriod(primkaRows, view), [primkaRows, view])
  const otpremaSortByPeriod = useMemo(() => aggregateSortimentiByPeriod(otpremaRows, view), [otpremaRows, view])

  const activeSortData = (dataSource === 'sjeca' ? primkaSortByPeriod : otpremaSortByPeriod).slice(-N)
  const periodSlice = periodCompareData.slice(-N)

  const sortChartData = activeSortData.map(p => ({
    name: p.label,
    trupciC: p.trupciC, trupciL: p.trupciL,
    celDuga: p.celDuga, celCijepana: p.celCijepana,
    ogrDugi: p.ogrDugi, ogrCijepani: p.ogrCijepani,
    gule: p.gule, skart: p.skart,
  }))
  const activeSortKeys = ALL_SORT_KEYS.filter(k => sortChartData.some(d => d[k] > 0))

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju podataka</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline hover:no-underline">
          Pokušaj ponovo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Trendovi</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Usporedba sječe i otpreme drvnih sortimenata
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
        <PrintButton />
      </div>

      {loading && filteredPrimka.length === 0 ? (
        <Skeleton />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Ukupna sječa"
              value={totalPrimka}
              unit="m³"
              description="Posječeno u periodu"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
            />
            <StatsCard
              title="Ukupna otprema"
              value={totalOtprema}
              unit="m³"
              description="Otpremljeno u periodu"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
            />
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3 shadow-sm">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Balans (sječa – otprema)</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold tabular-nums ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {balance >= 0 ? '+' : ''}{formatNumber(balance)}
                </span>
                <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">m³</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {balance >= 0 ? 'Više posječeno nego otpremljeno' : 'Više otpremljeno nego posječeno'}
              </p>
            </div>
          </div>

          {/* Daily charts */}
          <TrendLineChart data={primkaDailyData} title="Dnevni trend sječe (m³)" height={280} />
          <TrendLineChart data={otpremaDailyData} title="Dnevni trend otpreme (m³)" height={280} />

          {/* Period analysis */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Periodična analiza</h3>
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  options={[{ value: 'sedmicno', label: 'Sedmično' }, { value: 'mjesecno', label: 'Mjesečno' }]}
                  value={periodView}
                  onChange={v => setPeriodView(v as PeriodView)}
                />
                <ToggleGroup
                  options={[{ value: 'sjeca', label: 'Sječa' }, { value: 'otprema', label: 'Otprema' }]}
                  value={dataSource}
                  onChange={v => setDataSource(v as DataSource)}
                />
              </div>
            </div>

            {/* Sječa vs Otprema grouped bar */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Sječa vs Otprema &mdash; ukupno (m³)
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={periodSlice} margin={{ top: 4, right: 8, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-38} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatNumber(v, 0)} width={62} />
                  <Tooltip formatter={(v: number, name: string) => [`${formatNumber(v)} m³`, name === 'sjeca' ? 'Sječa' : 'Otprema']} />
                  <Legend formatter={v => v === 'sjeca' ? 'Sječa' : 'Otprema'} />
                  <Bar dataKey="sjeca" name="sjeca" fill="#16a34a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="otprema" name="otprema" fill="#2563eb" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stacked sortiment bar */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {dataSource === 'sjeca' ? 'Sječa' : 'Otprema'} po sortimentima (m³)
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sortChartData} margin={{ top: 4, right: 8, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-38} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatNumber(v, 0)} width={62} />
                  <Tooltip formatter={(v: number, name: string) => [`${formatNumber(v)} m³`, name]} />
                  <Legend />
                  {activeSortKeys.map(k => (
                    <Bar key={k} dataKey={k} name={SORT_LABELS[k]} stackId="a" fill={SORT_COLORS[k]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed sortiment × period table */}
            <SortimentiPeriodTable data={activeSortData} dataSource={dataSource} />
          </div>
        </>
      )}
    </div>
  )
}

function ToggleGroup({
  options, value, onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === o.value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SortimentiPeriodTable({ data, dataSource }: { data: PeriodSortimenti[]; dataSource: DataSource }) {
  const activeKeys = ALL_SORT_KEYS.filter(k => data.some(p => p[k] > 0))
  if (activeKeys.length === 0 || data.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Detaljna tablica sortimentnih volumena &mdash; {dataSource === 'sjeca' ? 'Sječa' : 'Otprema'} (m³)
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="text-xs min-w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-800/60 min-w-[110px]">
                Sortiment
              </th>
              {data.map(p => (
                <th key={p.sortKey} className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-500 whitespace-nowrap">
                  {p.label}
                </th>
              ))}
              <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Ukupno
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {activeKeys.map(k => {
              const rowTotal = data.reduce((s, p) => s + p[k], 0)
              return (
                <tr key={k} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="py-2 px-3 font-medium sticky left-0 bg-white dark:bg-gray-900" style={{ color: SORT_COLORS[k] }}>
                    {SORT_LABELS[k]}
                  </td>
                  {data.map(p => (
                    <td key={p.sortKey} className="text-right py-2 px-3 tabular-nums text-gray-600 dark:text-gray-300">
                      {p[k] > 0 ? formatNumber(p[k]) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  ))}
                  <td className="text-right py-2 px-3 tabular-nums font-semibold text-gray-700 dark:text-gray-200">
                    {formatNumber(rowTotal)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40">
              <td className="py-2.5 px-3 font-bold text-gray-800 dark:text-gray-200 sticky left-0 bg-gray-50 dark:bg-gray-800/40">
                UKUPNO
              </td>
              {data.map(p => (
                <td key={p.sortKey} className="text-right py-2.5 px-3 font-bold tabular-nums text-gray-800 dark:text-gray-200">
                  {formatNumber(p.ukupno)}
                </td>
              ))}
              <td className="text-right py-2.5 px-3 font-bold tabular-nums text-gray-800 dark:text-gray-200">
                {formatNumber(data.reduce((s, p) => s + p.ukupno, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
      </div>
      <div className="h-72 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      <div className="h-72 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  )
}

