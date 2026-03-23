import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { getQuickSelectRange, filterByDateRange, aggregateDailyTotals } from '@/lib/utils'
import type { DateRange, DailyTotal } from '@/lib/types'
import { format } from 'date-fns'

export default function Trendovi() {
  const { primkaRows, otpremaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('90d'))

  const filteredPrimka = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const filteredOtprema = useMemo(() => filterByDateRange(otpremaRows, range), [otpremaRows, range])

  const primkaDailyTotals = useMemo(() => aggregateDailyTotals(filteredPrimka), [filteredPrimka])

  const otpremaDailyTotals = useMemo<DailyTotal[]>(() => {
    const map = new Map<string, DailyTotal>()
    for (const row of filteredOtprema) {
      const key = format(row.datum, 'yyyy-MM-dd')
      const ex = map.get(key)
      if (ex) { ex.ukupno += row.ukupno; ex.cetinari += row.sigma_cetinari; ex.liscare += row.liscare }
      else map.set(key, { datum: key, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare })
    }
    return Array.from(map.values()).sort((a, b) => a.datum.localeCompare(b.datum))
  }, [filteredOtprema])

  const monthlyTotals = useMemo<DailyTotal[]>(() => {
    const map = new Map<string, DailyTotal>()
    for (const row of filteredPrimka) {
      const key = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, '0')}`
      const ex = map.get(key)
      if (ex) { ex.ukupno += row.ukupno; ex.cetinari += row.sigma_cetinari; ex.liscare += row.liscare }
      else map.set(key, { datum: key, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare })
    }
    return Array.from(map.values()).sort((a, b) => a.datum.localeCompare(b.datum))
  }, [filteredPrimka])

  const totalPrimka = filteredPrimka.reduce((s, r) => s + r.ukupno, 0)
  const totalOtprema = filteredOtprema.reduce((s, r) => s + r.ukupno, 0)
  const balance = totalPrimka - totalOtprema

  if (error) return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
      <p className="text-sm text-red-700 dark:text-red-400 mb-3">{error}</p>
      <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline">Pokušaj ponovo</button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Trendovi</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vremenski trendovi sječe i otpreme</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Ukupno posječeno" value={totalPrimka} unit="m³" description="sječa (primka)" />
        <StatsCard title="Ukupno otpremljeno" value={totalOtprema} unit="m³" description="otprema" />
        <StatsCard title="Balans" value={balance} unit="m³"
          description={balance >= 0 ? 'posječeno > otpremljeno' : 'otpremljeno > posječeno'}
          trend={totalOtprema > 0 ? (balance / totalOtprema) * 100 : undefined} />
      </div>

      {loading && primkaDailyTotals.length === 0 ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : (
        <>
          <TrendLineChart data={primkaDailyTotals} title="Dnevni trend sječe (m³)" height={320} />
          {otpremaDailyTotals.length > 0 && (
            <TrendLineChart data={otpremaDailyTotals} title="Dnevni trend otpreme (m³)" height={320} />
          )}
          {monthlyTotals.length > 1 && (
            <TrendLineChart data={monthlyTotals} title="Mjesečni trend sječe (m³)" height={280} />
          )}
        </>
      )}
    </div>
  )
}
