import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { PrintButton } from '@/components/PrintButton'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { OdjelPieChart } from '@/components/charts/OdjelPieChart'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import {
  getYearRange, getAvailableYears,
  filterByDateRange,
  aggregateOdjelSummary,
  aggregateDailyTotals,
  aggregateGrades,
  aggregateRadilisteSummary,
  getTotalUkupno,
  getTotalCetinari,
  getTotalLiscare,
  formatNumber,
} from '@/lib/utils'
import type { DateRange } from '@/lib/types'

export default function IzvođačDetail() {
  const { id } = useParams<{ id: string }>()
  const izvođačName = id ? decodeURIComponent(id) : ''
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getYearRange(new Date().getFullYear()))

  const izvođačRows = useMemo(
    () => primkaRows.filter((r) => r.izvođač === izvođačName),
    [primkaRows, izvođačName]
  )
  const availableYears = useMemo(() => getAvailableYears(izvođačRows), [izvođačRows])

  const filtered = useMemo(() => filterByDateRange(izvođačRows, range), [izvođačRows, range])

  const totalUkupno = getTotalUkupno(filtered)
  const totalCetinari = getTotalCetinari(filtered)
  const totalLiscare = getTotalLiscare(filtered)

  const odjelData = useMemo(() => aggregateOdjelSummary(filtered), [filtered])
  const dailyData = useMemo(() => aggregateDailyTotals(filtered), [filtered])
  const gradeData = useMemo(() => aggregateGrades(filtered), [filtered])
  const radilistData = useMemo(() => aggregateRadilisteSummary(filtered), [filtered])

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline hover:no-underline">
          Pokušaj ponovo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link to="/radilista" className="hover:text-forest-600 dark:hover:text-forest-400 transition-colors">
          Radilišta & Izvođači
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">{izvođačName || '—'}</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{izvođačName || 'Nepoznat izvođač'}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detaljna analiza za odabranog izvođača radova</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} years={availableYears} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
        <PrintButton />
      </div>

      {loading && filtered.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Ukupno" value={totalUkupno} unit="m³" />
            <StatsCard title="Četinari" value={totalCetinari} unit="m³"
              description={`${totalUkupno > 0 ? ((totalCetinari / totalUkupno) * 100).toFixed(1) : 0}%`} />
            <StatsCard title="Lišćari" value={totalLiscare} unit="m³"
              description={`${totalUkupno > 0 ? ((totalLiscare / totalUkupno) * 100).toFixed(1) : 0}%`} />
            <StatsCard title="Broj primki" value={filtered.length} unit="" decimals={0} />
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">Nema podataka za odabrani period.</p>
            </div>
          ) : (
            <>
              <TrendLineChart data={dailyData} title={`Dnevni trend – ${izvođačName}`} height={300} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <OdjelPieChart data={odjelData} title="Distribucija po odjelu" height={300} />
                <VolumeBarChart data={gradeData} title="Volumen po klasi sortimenta (m³)" height={300} />
              </div>

              {radilistData.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Radilišta izvođača</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Radilište</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Br. primki</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Četinari (m³)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lišćari (m³)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ukupno (m³)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Udio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {radilistData.map((row) => (
                          <tr key={row.radiliste} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.radiliste}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.count}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalCetinari)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalLiscare)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100">{formatNumber(row.totalUkupno)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                              {totalUkupno > 0 ? ((row.totalUkupno / totalUkupno) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
