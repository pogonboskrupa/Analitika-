import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import {
  getQuickSelectRange,
  filterByDateRange,
  aggregateDailyTotals,
  getTotalUkupno,
  formatNumber,
} from '@/lib/utils'
import type { DateRange, OtpremaRow, DailyTotal } from '@/lib/types'
import { format } from 'date-fns'

function aggregateOtpremaDailyTotals(rows: OtpremaRow[]): DailyTotal[] {
  const map = new Map<string, DailyTotal>()
  for (const row of rows) {
    const key = format(row.datum, 'yyyy-MM-dd')
    const existing = map.get(key)
    if (existing) {
      existing.ukupno += row.ukupno
      existing.cetinari += row.sigma_cetinari
      existing.liscare += row.liscare
    } else {
      map.set(key, {
        datum: key,
        ukupno: row.ukupno,
        cetinari: row.sigma_cetinari,
        liscare: row.liscare,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.datum.localeCompare(b.datum))
}

function aggregateMonthlyTotals(primka: DailyTotal[], otprema: DailyTotal[]): Array<{datum: string; primka: number; otprema: number}> {
  const map = new Map<string, { primka: number; otprema: number }>()
  for (const d of primka) {
    const month = d.datum.slice(0, 7)
    const e = map.get(month) ?? { primka: 0, otprema: 0 }
    e.primka += d.ukupno
    map.set(month, e)
  }
  for (const d of otprema) {
    const month = d.datum.slice(0, 7)
    const e = map.get(month) ?? { primka: 0, otprema: 0 }
    e.otprema += d.ukupno
    map.set(month, e)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datum, v]) => ({ datum, ...v }))
}

export default function Trendovi() {
  const { primkaRows, otpremaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('30d'))

  const filteredPrimka = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const filteredOtprema = useMemo(() => filterByDateRange(otpremaRows, range), [otpremaRows, range])

  const totalPrimka = getTotalUkupno(filteredPrimka)
  const totalOtprema = filteredOtprema.reduce((s, r) => s + r.ukupno, 0)
  const balance = totalPrimka - totalOtprema

  const primkaDailyData = useMemo(() => aggregateDailyTotals(filteredPrimka), [filteredPrimka])
  const otpremaDailyData = useMemo(() => aggregateOtpremaDailyTotals(filteredOtprema), [filteredOtprema])
  const monthlyData = useMemo(
    () => aggregateMonthlyTotals(
      aggregateDailyTotals(primkaRows),
      aggregateOtpremaDailyTotals(otpremaRows)
    ),
    [primkaRows, otpremaRows]
  )

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
          Usporedba primke i otpreme drvnih sortimenata
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
      </div>

      {loading && filteredPrimka.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Balance KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Ukupna primka"
              value={totalPrimka}
              unit="m³"
              description="Posječeno u periodu"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              }
            />
            <StatsCard
              title="Ukupna otprema"
              value={totalOtprema}
              unit="m³"
              description="Otpremljeno u periodu"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              }
            />
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3 shadow-sm">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Balans (primka – otprema)</p>
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

          {/* Daily trend charts */}
          <TrendLineChart data={primkaDailyData} title="Dnevni trend primke (m³)" height={300} />
          <TrendLineChart data={otpremaDailyData} title="Dnevni trend otpreme (m³)" height={300} />

          {/* Monthly comparison */}
          {monthlyData.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Mjesečna usporedba (svi podaci)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Mjesec</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Primka (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Otprema (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Balans (m³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {monthlyData.map((row) => {
                      const bal = row.primka - row.otprema
                      return (
                        <tr key={row.datum} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.datum}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.primka)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.otprema)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${bal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {bal >= 0 ? '+' : ''}{formatNumber(bal)}
                          </td>
                        </tr>
                      )
                    })}
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
