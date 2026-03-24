import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { OdjelPieChart } from '@/components/charts/OdjelPieChart'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import {
  getQuickSelectRange,
  filterByDateRange,
  aggregateOdjelSummary,
  aggregateDailyTotals,
  getTotalUkupno,
  getTotalCetinari,
  getTotalLiscare,
  formatNumber,
} from '@/lib/utils'
import type { DateRange, PrimkaRow } from '@/lib/types'

export default function PrimacDetail() {
  const { id } = useParams<{ id: string }>()
  const primacName = id ? decodeURIComponent(id) : ''
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))

  const primacRows: PrimkaRow[] = useMemo(
    () => primkaRows.filter((r) => r.primac === primacName),
    [primkaRows, primacName]
  )

  const filtered = useMemo(() => filterByDateRange(primacRows, range), [primacRows, range])

  const totalUkupno = getTotalUkupno(filtered)
  const totalCetinari = getTotalCetinari(filtered)
  const totalLiscare = getTotalLiscare(filtered)

  const odjelData = useMemo(() => aggregateOdjelSummary(filtered), [filtered])
  const dailyData = useMemo(() => aggregateDailyTotals(filtered), [filtered])

  const gradeBarData = useMemo(() => {
    const total = (key: keyof PrimkaRow) =>
      filtered.reduce((s, r) => s + (r[key] as number), 0)
    return [
      { name: 'FL', cetinari: total('fl_c'), liscare: total('fl_l'), ukupno: total('fl_c') + total('fl_l') },
      { name: 'I', cetinari: total('i_c'), liscare: total('i_l'), ukupno: total('i_c') + total('i_l') },
      { name: 'II', cetinari: total('ii_c'), liscare: total('ii_l'), ukupno: total('ii_c') + total('ii_l') },
      { name: 'III', cetinari: total('iii_c'), liscare: total('iii_l'), ukupno: total('iii_c') + total('iii_l') },
      { name: 'Trupci', cetinari: total('trupci_c'), liscare: total('trupci_l'), ukupno: total('trupci_c') + total('trupci_l') },
    ].filter((d) => d.ukupno > 0)
  }, [filtered])

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
        <Link to="/primaci" className="hover:text-forest-600 dark:hover:text-forest-400 transition-colors">
          Primači
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">{primacName || '—'}</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{primacName || 'Nepoznat primač'}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detaljna analiza za odabranog primača</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
      </div>

      {loading && filtered.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
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
              <TrendLineChart data={dailyData} title={"Dnevni trend – " + primacName} height={300} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <OdjelPieChart data={odjelData} title="Distribucija po odjelu" height={300} />
                <VolumeBarChart data={gradeBarData} title="Volumen po klasi (m³)" height={300} />
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Sažetak po odjelu</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Odjel</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ukupno (m³)</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Udio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {odjelData.map((row) => (
                        <tr key={row.odjel} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.odjel || '—'}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalUkupno)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                            {totalUkupno > 0 ? ((row.totalUkupno / totalUkupno) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
