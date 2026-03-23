import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { OdjelPieChart } from '@/components/charts/OdjelPieChart'
import {
  getQuickSelectRange, filterByDateRange,
  aggregatePrimacSummary, aggregateOdjelSummary, aggregateDailyTotals,
  getTotalUkupno, getTotalCetinari, getTotalLiscare,
} from '@/lib/utils'
import type { DateRange } from '@/lib/types'

export default function Dashboard() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('30d'))

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])

  const totalUkupno = getTotalUkupno(filtered)
  const totalCetinari = getTotalCetinari(filtered)
  const totalLiscare = getTotalLiscare(filtered)
  const top10 = useMemo(() =>
    aggregatePrimacSummary(filtered).slice(0, 10).map(p => ({
      name: p.primac, cetinari: p.totalCetinari, liscare: p.totalLiscare, ukupno: p.totalUkupno,
    })), [filtered])
  const odjelData = useMemo(() => aggregateOdjelSummary(filtered), [filtered])
  const dailyData = useMemo(() => aggregateDailyTotals(filtered), [filtered])

  if (error) return <ErrorCard message={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pregled sječe i otpreme drvnih sortimenata
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
      </div>

      {loading && filtered.length === 0 ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard title="Ukupno" value={totalUkupno} unit="m³"
              icon={<HomeIcon />} description="sječa" />
            <StatsCard title="Četinari" value={totalCetinari} unit="m³"
              icon={<TreeIcon />}
              description={`${totalUkupno > 0 ? ((totalCetinari / totalUkupno) * 100).toFixed(1) : 0}% od ukupnog`} />
            <StatsCard title="Lišćari" value={totalLiscare} unit="m³"
              icon={<LeafIcon />}
              description={`${totalUkupno > 0 ? ((totalLiscare / totalUkupno) * 100).toFixed(1) : 0}% od ukupnog`} />
            <StatsCard title="Broj primki" value={filtered.length} unit="" decimals={0}
              icon={<DocIcon />} description="zapisa" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VolumeBarChart data={top10} title="Top 10 primača po volumenu (m³)" height={300} />
            <OdjelPieChart data={odjelData} title="Volumen po odjelu" height={300} />
          </div>

          <TrendLineChart data={dailyData} title="Dnevni trend sječe (m³)" height={320} />
        </>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
      <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju podataka</h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-4">{message}</p>
      <button onClick={onRetry}
        className="text-sm font-medium text-red-700 dark:text-red-400 underline hover:no-underline">
        Pokušaj ponovo
      </button>
    </div>
  )
}

const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="9 22 9 12 15 12 15 22" />
  </svg>
)
const TreeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polygon strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="12 2 19 21 12 17 5 21 12 2" />
  </svg>
)
const LeafIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
)
const DocIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="14 2 14 8 20 8" />
    <line strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} x1="16" y1="13" x2="8" y2="13" />
    <line strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} x1="16" y1="17" x2="8" y2="17" />
  </svg>
)
