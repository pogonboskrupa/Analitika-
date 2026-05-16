import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import { OdjelPieChart } from '@/components/charts/OdjelPieChart'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { PrintButton } from '@/components/PrintButton'
import {
  getYearRange, getAvailableYears,
  filterByDateRange,
  aggregateOtpremacSummary,
  aggregateOtpremaDailyTotals,
  getTotalOtpremaUkupno,
  getTotalOtpremaCetinari,
  getTotalOtpremaLiscare,
  formatNumber,
} from '@/lib/utils'
import type { DateRange } from '@/lib/types'

export default function Otprema() {
  const { otpremaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getYearRange(new Date().getFullYear()))
  const availableYears = useMemo(() => getAvailableYears(otpremaRows), [otpremaRows])

  const filteredOtprema = useMemo(() => filterByDateRange(otpremaRows, range), [otpremaRows, range])

  const totalUkupno = getTotalOtpremaUkupno(filteredOtprema)
  const totalCetinari = getTotalOtpremaCetinari(filteredOtprema)
  const totalLiscare = getTotalOtpremaLiscare(filteredOtprema)

  const otpremacSummaries = useMemo(() => aggregateOtpremacSummary(filteredOtprema), [filteredOtprema])

  const top10 = useMemo(() =>
    otpremacSummaries.slice(0, 10).map(o => ({
      name: o.otpremac, cetinari: o.totalCetinari, liscare: o.totalLiscare, ukupno: o.totalUkupno,
    })), [otpremacSummaries])

  const otpremaOdjelData = useMemo(() => {
    const map = new Map<string, number>()
    filteredOtprema.forEach(r => map.set(r.odjel || '—', (map.get(r.odjel || '—') ?? 0) + r.ukupno))
    return Array.from(map.entries()).map(([odjel, totalUkupno]) => ({ odjel, totalUkupno })).sort((a, b) => b.totalUkupno - a.totalUkupno)
  }, [filteredOtprema])

  const dailyData = useMemo(() => aggregateOtpremaDailyTotals(filteredOtprema), [filteredOtprema])

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Otprema</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pregled otpreme drvnih sortimenata
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} years={availableYears} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
        <PrintButton />
      </div>

      {loading && filteredOtprema.length === 0 ? (
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
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard title="Ukupno otpremljeno" value={totalUkupno} unit="m³"
              icon={<TruckIcon />} description="otprema" />
            <StatsCard title="Četinari" value={totalCetinari} unit="m³"
              icon={<TreeIcon />}
              description={`${totalUkupno > 0 ? ((totalCetinari / totalUkupno) * 100).toFixed(1) : 0}% od ukupnog`} />
            <StatsCard title="Lišćari" value={totalLiscare} unit="m³"
              icon={<LeafIcon />}
              description={`${totalUkupno > 0 ? ((totalLiscare / totalUkupno) * 100).toFixed(1) : 0}% od ukupnog`} />
            <StatsCard title="Broj otprema" value={filteredOtprema.length} unit="" decimals={0}
              icon={<DocIcon />} description="zapisa" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VolumeBarChart data={top10} title="Top 10 otpremača po volumenu (m³)" height={300} />
            <OdjelPieChart data={otpremaOdjelData} title="Volumen po odjelu" height={300} />
          </div>

          <TrendLineChart data={dailyData} title="Dnevni trend otpreme (m³)" height={320} />

          {otpremacSummaries.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pregled po otpremačima</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Otpremač</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Br. otprema</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Četinari (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lišćari (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ukupno (m³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {otpremacSummaries.map((row, i) => (
                      <tr key={row.otpremac} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.otpremac}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.count}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalCetinari)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalLiscare)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100">{formatNumber(row.totalUkupno)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const TruckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="1" y="3" width="15" height="13" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <circle cx="5.5" cy="18.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <circle cx="18.5" cy="18.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
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
