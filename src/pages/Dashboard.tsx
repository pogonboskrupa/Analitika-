import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { OdjelPieChart } from '@/components/charts/OdjelPieChart'
import { PrintButton } from '@/components/PrintButton'
import {
  getQuickSelectRange, getLastNDaysRange, filterByDateRange,

  aggregatePrimacSummary, aggregateOdjelSummary, aggregateDailyTotals,
  getTotalUkupno, getTotalCetinari, getTotalLiscare,
  aggregateGrades, formatNumber,
} from '@/lib/utils'
import type { DateRange, PrimkaRow, OtpremaRow } from '@/lib/types'

const PERIOD_DAYS = [1, 2, 3, 4, 5, 6, 7, 10, 30]

function sumSortimenti(rows: PrimkaRow[] | OtpremaRow[]) {
  const s = (key: string) => rows.reduce((acc, r) => acc + (((r as unknown) as Record<string, number>)[key] || 0), 0)
  // trupci_c / trupci_l are the sheet-computed sums of (FL+I+II+III+RD) —
  // adding the individual grade fields on top would double-count them.
  // skart is excluded: it is not part of ukupno in the sheet, so including it
  // here would inflate the sortiment total above the actual sječa volume.
  return {
    trupciC:     s('trupci_c'),
    trupciL:     s('trupci_l'),
    celDuga:     s('cel_duga'),
    celCijepana: s('cel_cijepana'),
    ogrDugi:     s('ogr_dugi'),
    ogrCijepani: s('ogr_cijepani'),
    gule:        s('gule'),
  }
}

export default function Dashboard() {
  const { primkaRows, otpremaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))

  const [sortDays, setSortDays] = useState(7)

  const sortRange = useMemo(() => getLastNDaysRange(sortDays), [sortDays])

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const periodPrimka = useMemo(() => filterByDateRange(primkaRows, sortRange), [primkaRows, sortRange])
  const periodOtprema = useMemo(() => filterByDateRange(otpremaRows, sortRange), [otpremaRows, sortRange])
  const sjecaSortimenti = useMemo(() => sumSortimenti(periodPrimka), [periodPrimka])
  const otpremaSortimenti = useMemo(() => sumSortimenti(periodOtprema), [periodOtprema])

  const totalUkupno = getTotalUkupno(filtered)
  const totalCetinari = getTotalCetinari(filtered)
  const totalLiscare = getTotalLiscare(filtered)
  const top10 = useMemo(() =>
    aggregatePrimacSummary(filtered).slice(0, 10).map(p => ({
      name: p.primac, cetinari: p.totalCetinari, liscare: p.totalLiscare, ukupno: p.totalUkupno,
    })), [filtered])
  const odjelData = useMemo(() => aggregateOdjelSummary(filtered), [filtered])
  const dailyData = useMemo(() => aggregateDailyTotals(filtered), [filtered])
  const gradeData = useMemo(() => aggregateGrades(filtered), [filtered])

  const periodLabel = `Posljednjih ${sortDays} dan${sortDays === 1 ? '' : 'a'}`

  if (error) return <ErrorCard message={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pregled sječe i otpreme drvnih sortimenata
        </p>
      </div>

      {/* Žuti filter — kontrolira sortimenti tabelu */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIOD_DAYS.map(d => (
          <button
            key={d}
            onClick={() => setSortDays(d)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              sortDays === d
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {d}d
          </button>
        ))}
        {loading && <span className="text-xs text-gray-400 animate-pulse ml-2">Učitavanje...</span>}
      </div>

      {loading && filtered.length === 0 ? (
        <Skeleton />
      ) : (
        <>
          {/* Sječa i otprema po sortimentima */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">
              Sječa i otprema po sortimentima
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {periodLabel} &mdash; sječa: {periodPrimka.length} primki, otprema: {periodOtprema.length} zapisa
            </p>
            <SortimentiTable sjeca={sjecaSortimenti} otprema={otpremaSortimenti} />
          </div>

          {/* Crveni filter — kontrolira stats kartice i grafove */}
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={range} onChange={setRange} />
            <PrintButton />
          </div>

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
          <VolumeBarChart data={gradeData} title="Volumen po klasi sortimenta (m³)" height={300} />
        </>
      )}
    </div>
  )
}

type SortimentiSums = ReturnType<typeof sumSortimenti>

function SortimentiTable({ sjeca, otprema }: { sjeca: SortimentiSums; otprema: SortimentiSums }) {
  const rows: { label: string; tip: string; sjecaVal: number; otpremaVal: number }[] = [
    { label: 'TRUPCI', tip: 'Četinari', sjecaVal: sjeca.trupciC, otpremaVal: otprema.trupciC },
    { label: 'TRUPCI', tip: 'Lišćari', sjecaVal: sjeca.trupciL, otpremaVal: otprema.trupciL },
    { label: 'Cel. duga', tip: '', sjecaVal: sjeca.celDuga, otpremaVal: otprema.celDuga },
    { label: 'Cel. cijepana', tip: '', sjecaVal: sjeca.celCijepana, otpremaVal: otprema.celCijepana },
    { label: 'Ogr. dugi', tip: '', sjecaVal: sjeca.ogrDugi, otpremaVal: otprema.ogrDugi },
    { label: 'Ogr. cijepani', tip: '', sjecaVal: sjeca.ogrCijepani, otpremaVal: otprema.ogrCijepani },
    { label: 'Gule', tip: '', sjecaVal: sjeca.gule, otpremaVal: otprema.gule },
  ].filter(r => r.sjecaVal > 0 || r.otpremaVal > 0)

  const totalSjeca = rows.reduce((s, r) => s + r.sjecaVal, 0)
  const totalOtprema = rows.reduce((s, r) => s + r.otpremaVal, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300 w-40">Sortiment</th>
            <th className="text-right py-2 px-4 font-semibold text-green-700 dark:text-green-400">Sječa (m³)</th>
            <th className="text-right py-2 px-4 font-semibold text-blue-700 dark:text-blue-400">Otprema (m³)</th>
            <th className="text-right py-2 pl-4 font-semibold text-gray-500 dark:text-gray-400">Razlika (m³)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const diff = r.sjecaVal - r.otpremaVal
            const isTrupci = r.label === 'TRUPCI'
            return (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 pr-4">
                  <span className={`font-medium ${isTrupci ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    {r.label}
                  </span>
                  {r.tip && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({r.tip})</span>}
                </td>
                <td className="text-right py-2 px-4 font-mono text-green-700 dark:text-green-400">
                  {formatNumber(r.sjecaVal)}
                </td>
                <td className="text-right py-2 px-4 font-mono text-blue-700 dark:text-blue-400">
                  {formatNumber(r.otpremaVal)}
                </td>
                <td className={`text-right py-2 pl-4 font-mono ${diff >= 0 ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
                  {diff >= 0 ? '+' : ''}{formatNumber(diff)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 dark:border-gray-600">
            <td className="py-2 pr-4 font-bold text-gray-900 dark:text-gray-100">UKUPNO</td>
            <td className="text-right py-2 px-4 font-bold font-mono text-green-700 dark:text-green-400">
              {formatNumber(totalSjeca)}
            </td>
            <td className="text-right py-2 px-4 font-bold font-mono text-blue-700 dark:text-blue-400">
              {formatNumber(totalOtprema)}
            </td>
            <td className={`text-right py-2 pl-4 font-bold font-mono ${totalSjeca - totalOtprema >= 0 ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}`}>
              {totalSjeca - totalOtprema >= 0 ? '+' : ''}{formatNumber(totalSjeca - totalOtprema)}
            </td>
          </tr>
        </tfoot>
      </table>
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
