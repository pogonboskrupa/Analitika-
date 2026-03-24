import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { PrintButton } from '@/components/PrintButton'
import {
  getQuickSelectRange, filterByDateRange,
  getTotalUkupno, getTotalCetinari, getTotalLiscare,
  getTotalOtpremaUkupno, getTotalOtpremaCetinari, getTotalOtpremaLiscare,
  formatNumber,
} from '@/lib/utils'
import type { DateRange, PrimkaRow, OtpremaRow } from '@/lib/types'

interface SortimentRow {
  label: string
  group: string
  sjecaKey: keyof PrimkaRow
  otpremaKey: keyof OtpremaRow
}

const SORTIMENTI: SortimentRow[] = [
  { label: 'Trupci četinari', group: 'Četinari', sjecaKey: 'trupci_c', otpremaKey: 'trupci_c' },
  { label: 'FL četinari', group: 'Četinari', sjecaKey: 'fl_c', otpremaKey: 'fl_c' },
  { label: 'I klasa četinari', group: 'Četinari', sjecaKey: 'i_c', otpremaKey: 'i_c' },
  { label: 'II klasa četinari', group: 'Četinari', sjecaKey: 'ii_c', otpremaKey: 'ii_c' },
  { label: 'III klasa četinari', group: 'Četinari', sjecaKey: 'iii_c', otpremaKey: 'iii_c' },
  { label: 'Rudničko drvo', group: 'Četinari', sjecaKey: 'rd_c', otpremaKey: 'rd_c' },
  { label: 'Celuloza duga', group: 'Četinari', sjecaKey: 'cel_duga', otpremaKey: 'cel_duga' },
  { label: 'Celuloza cijepana', group: 'Četinari', sjecaKey: 'cel_cijepana', otpremaKey: 'cel_cijepana' },
  { label: 'Škart', group: 'Četinari', sjecaKey: 'skart', otpremaKey: 'skart' },
  { label: 'Trupci lišćari', group: 'Lišćari', sjecaKey: 'trupci_l', otpremaKey: 'trupci_l' },
  { label: 'FL lišćari', group: 'Lišćari', sjecaKey: 'fl_l', otpremaKey: 'fl_l' },
  { label: 'I klasa lišćari', group: 'Lišćari', sjecaKey: 'i_l', otpremaKey: 'i_l' },
  { label: 'II klasa lišćari', group: 'Lišćari', sjecaKey: 'ii_l', otpremaKey: 'ii_l' },
  { label: 'III klasa lišćari', group: 'Lišćari', sjecaKey: 'iii_l', otpremaKey: 'iii_l' },
  { label: 'Ogrevno dugo', group: 'Lišćari', sjecaKey: 'ogr_dugi', otpremaKey: 'ogr_dugi' },
  { label: 'Ogrevno cijepano', group: 'Lišćari', sjecaKey: 'ogr_cijepani', otpremaKey: 'ogr_cijepani' },
  { label: 'Gule', group: 'Lišćari', sjecaKey: 'gule', otpremaKey: 'gule' },
]

function sumField(rows: PrimkaRow[], key: keyof PrimkaRow): number {
  return rows.reduce((acc, r) => acc + ((r[key] as number) || 0), 0)
}

function sumOtpremaField(rows: OtpremaRow[], key: keyof OtpremaRow): number {
  return rows.reduce((acc, r) => acc + ((r[key] as number) || 0), 0)
}

export default function StanjeZaliha() {
  const { primkaRows, otpremaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('all'))

  const filteredPrimka = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const filteredOtprema = useMemo(() => filterByDateRange(otpremaRows, range), [otpremaRows, range])

  const totalSjeca = getTotalUkupno(filteredPrimka)
  const totalOtprema = getTotalOtpremaUkupno(filteredOtprema)
  const totalBilans = totalSjeca - totalOtprema

  const totalSjecaCet = getTotalCetinari(filteredPrimka)
  const totalOtpremaCet = getTotalOtpremaCetinari(filteredOtprema)
  const totalSjecaLis = getTotalLiscare(filteredPrimka)
  const totalOtpremaLis = getTotalOtpremaLiscare(filteredOtprema)

  const tableRows = useMemo(() =>
    SORTIMENTI.map(s => {
      const sjeca = sumField(filteredPrimka, s.sjecaKey)
      const otprema = sumOtpremaField(filteredOtprema, s.otpremaKey)
      const bilans = sjeca - otprema
      const pct = sjeca > 0 ? Math.min((otprema / sjeca) * 100, 100) : 0
      return { ...s, sjeca, otprema, bilans, pct }
    }).filter(r => r.sjeca > 0 || r.otprema > 0),
    [filteredPrimka, filteredOtprema]
  )

  const groupedRows = useMemo(() => {
    const groups: Record<string, typeof tableRows> = {}
    for (const row of tableRows) {
      if (!groups[row.group]) groups[row.group] = []
      groups[row.group].push(row)
    }
    return groups
  }, [tableRows])

  const pctOtpremljeno = totalSjeca > 0 ? Math.min((totalOtprema / totalSjeca) * 100, 100) : 0

  if (error) return <ErrorCard message={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Stanje Zaliha</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Bilans sječe i otpreme po sortimentima — koliko m³ čeka otpremu
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard
              title="Ukupno posječeno"
              value={totalSjeca}
              unit="m³"
              icon={<AxeIcon />}
              description="sječa u periodu"
            />
            <StatsCard
              title="Ukupno otpremljeno"
              value={totalOtprema}
              unit="m³"
              icon={<TruckIcon />}
              description="otprema u periodu"
            />
            <StatsCard
              title="Stanje zaliha"
              value={totalBilans}
              unit="m³"
              icon={<WarehouseIcon />}
              description={`${pctOtpremljeno.toFixed(1)}% otpremljeno`}
            />
            <StatsCard
              title="Neotpremljeno"
              value={pctOtpremljeno < 100 ? 100 - pctOtpremljeno : 0}
              unit="%"
              icon={<ClockIcon />}
              description={`${formatNumber(totalBilans > 0 ? totalBilans : 0)} m³ čeka otpremu`}
            />
          </div>

          {/* Overall progress bar */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ukupni procenat otpreme</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {pctOtpremljeno.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-green-500"
                style={{ width: `${pctOtpremljeno}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>Otpremljeno: {formatNumber(totalOtprema)} m³</span>
              <span>Posječeno: {formatNumber(totalSjeca)} m³</span>
            </div>
          </div>

          {/* Group summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GroupSummaryCard
              label="Četinari"
              sjeca={totalSjecaCet}
              otprema={totalOtpremaCet}
              color="blue"
            />
            <GroupSummaryCard
              label="Lišćari"
              sjeca={totalSjecaLis}
              otprema={totalOtpremaLis}
              color="amber"
            />
          </div>

          {/* Detailed sortiment table */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Bilans po sortimentu
            </h3>
            {Object.entries(groupedRows).map(([group, rows]) => (
              <div key={group}>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {group}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300">Sortiment</th>
                        <th className="text-right py-2 px-4 font-semibold text-green-700 dark:text-green-400">Sječa (m³)</th>
                        <th className="text-right py-2 px-4 font-semibold text-blue-700 dark:text-blue-400">Otprema (m³)</th>
                        <th className="text-right py-2 px-4 font-semibold text-gray-600 dark:text-gray-400">Bilans (m³)</th>
                        <th className="py-2 pl-4 font-semibold text-gray-500 dark:text-gray-400 text-left min-w-[140px]">% Otpremljeno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300 font-medium">{r.label}</td>
                          <td className="text-right py-2.5 px-4 font-mono text-green-700 dark:text-green-400">
                            {formatNumber(r.sjeca)}
                          </td>
                          <td className="text-right py-2.5 px-4 font-mono text-blue-700 dark:text-blue-400">
                            {formatNumber(r.otprema)}
                          </td>
                          <td className={`text-right py-2.5 px-4 font-mono font-semibold ${
                            r.bilans > 0
                              ? 'text-orange-600 dark:text-orange-400'
                              : r.bilans < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {r.bilans >= 0 ? '+' : ''}{formatNumber(r.bilans)}
                          </td>
                          <td className="py-2.5 pl-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    r.pct >= 90 ? 'bg-green-500' :
                                    r.pct >= 60 ? 'bg-yellow-500' :
                                    'bg-red-400'
                                  }`}
                                  style={{ width: `${r.pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-10 text-right">
                                {r.pct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                        <td className="py-2 pr-4 font-bold text-gray-900 dark:text-gray-100">Ukupno</td>
                        <td className="text-right py-2 px-4 font-bold font-mono text-green-700 dark:text-green-400">
                          {formatNumber(rows.reduce((s, r) => s + r.sjeca, 0))}
                        </td>
                        <td className="text-right py-2 px-4 font-bold font-mono text-blue-700 dark:text-blue-400">
                          {formatNumber(rows.reduce((s, r) => s + r.otprema, 0))}
                        </td>
                        <td className="text-right py-2 px-4 font-bold font-mono text-gray-600 dark:text-gray-300">
                          {(() => {
                            const diff = rows.reduce((s, r) => s + r.sjeca, 0) - rows.reduce((s, r) => s + r.otprema, 0)
                            return `${diff >= 0 ? '+' : ''}${formatNumber(diff)}`
                          })()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GroupSummaryCard({
  label, sjeca, otprema, color,
}: { label: string; sjeca: number; otprema: number; color: 'blue' | 'amber' }) {
  const bilans = sjeca - otprema
  const pct = sjeca > 0 ? Math.min((otprema / sjeca) * 100, 100) : 0
  const barColor = color === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
  const textColor = color === 'blue'
    ? 'text-blue-700 dark:text-blue-400'
    : 'text-amber-700 dark:text-amber-400'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-semibold ${textColor}`}>{label}</h4>
        <span className="text-xs text-gray-400">{pct.toFixed(1)}% otpremljeno</span>
      </div>
      <div className="space-y-1.5 text-sm mb-3">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Sječa</span>
          <span className="font-mono font-semibold text-green-700 dark:text-green-400">{formatNumber(sjeca)} m³</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Otprema</span>
          <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">{formatNumber(otprema)} m³</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-1.5">
          <span className="text-gray-500 dark:text-gray-400">Bilans</span>
          <span className={`font-mono font-bold ${bilans > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
            {bilans >= 0 ? '+' : ''}{formatNumber(bilans)} m³
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
      </div>
      <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl" />
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

const AxeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M14.5 2.5c0 1.5-1.5 3-3 4.5L3 15l1.5 1.5 3-3 1.5 1.5-3 3L7.5 19.5 15 12c1.5-1.5 3-3 4.5-3 0-2-1-4.5-5-6.5z" />
  </svg>
)

const TruckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="1" y="3" width="15" height="13" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <circle cx="5.5" cy="18.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <circle cx="18.5" cy="18.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
)

const WarehouseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 22V12h6v10" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
)
