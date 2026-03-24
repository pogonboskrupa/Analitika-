import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSheet } from '@/context/SheetContext'
import { StatsCard } from '@/components/StatsCard'
import { PrintButton } from '@/components/PrintButton'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import {
  aggregateByWeek,
  aggregateByMonth,
  aggregateByQuarter,
  aggregateByYear,
  aggregateOtpremaDailyTotals,
  getTotalOtpremaUkupno,
  getTotalOtpremaCetinari,
  getTotalOtpremaLiscare,
  formatNumber,
} from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { PeriodTotal } from '@/lib/types'

type Tab = 'sedmicno' | 'mjesecno' | 'kvartalno' | 'godisnje'

const TABS: { id: Tab; label: string }[] = [
  { id: 'sedmicno', label: 'Sedmično' },
  { id: 'mjesecno', label: 'Mjesečno' },
  { id: 'kvartalno', label: 'Kvartalno' },
  { id: 'godisnje', label: 'Godišnje' },
]

export default function KupacDetail() {
  const { id } = useParams<{ id: string }>()
  const kupacName = id ? decodeURIComponent(id) : ''
  const { otpremaRows, loading, error, refetch } = useSheet()
  const [activeTab, setActiveTab] = useState<Tab>('mjesecno')

  // All rows for this buyer (no date filter — show full history per period)
  const kupacRows = useMemo(
    () => otpremaRows.filter(r => r.kupac === kupacName),
    [otpremaRows, kupacName]
  )

  const totalUkupno = getTotalOtpremaUkupno(kupacRows)
  const totalCetinari = getTotalOtpremaCetinari(kupacRows)
  const totalLiscare = getTotalOtpremaLiscare(kupacRows)

  const dailyData = useMemo(() => aggregateOtpremaDailyTotals(kupacRows), [kupacRows])

  const weeklyData = useMemo(() => aggregateByWeek(kupacRows), [kupacRows])
  const monthlyData = useMemo(() => aggregateByMonth(kupacRows), [kupacRows])
  const quarterlyData = useMemo(() => aggregateByQuarter(kupacRows), [kupacRows])
  const yearlyData = useMemo(() => aggregateByYear(kupacRows), [kupacRows])

  const periodData: Record<Tab, PeriodTotal[]> = {
    sedmicno: weeklyData,
    mjesecno: monthlyData,
    kvartalno: quarterlyData,
    godisnje: yearlyData,
  }

  const chartData = useMemo(() =>
    periodData[activeTab].map(p => ({
      name: p.label,
      cetinari: p.cetinari,
      liscare: p.liscare,
      ukupno: p.ukupno,
    })),
    [activeTab, periodData]
  )

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline hover:no-underline">Pokušaj ponovo</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link to="/kupci" className="hover:text-forest-600 dark:hover:text-forest-400 transition-colors">
          Kupci
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">{kupacName || '—'}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{kupacName || 'Nepoznat kupac'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detaljna analiza otpreme — svi podaci</p>
        </div>
        <PrintButton />
      </div>

      {loading && kupacRows.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Stats — sveukupno (bez filtera) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Ukupno primljeno" value={totalUkupno} unit="m³" />
            <StatsCard title="Četinari" value={totalCetinari} unit="m³"
              description={`${totalUkupno > 0 ? ((totalCetinari / totalUkupno) * 100).toFixed(1) : 0}%`} />
            <StatsCard title="Lišćari" value={totalLiscare} unit="m³"
              description={`${totalUkupno > 0 ? ((totalLiscare / totalUkupno) * 100).toFixed(1) : 0}%`} />
            <StatsCard title="Broj otprema" value={kupacRows.length} unit="" decimals={0} />
          </div>

          {kupacRows.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">Nema podataka za ovog kupca.</p>
            </div>
          ) : (
            <>
              {/* Dnevni trend */}
              <TrendLineChart data={dailyData} title="Dnevni trend otpreme (m³)" height={280} />

              {/* Period analitika s tabovima */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                {/* Tab header */}
                <div className="flex items-center gap-0 border-b border-gray-200 dark:border-gray-800 px-4 pt-4">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                        activeTab === tab.id
                          ? 'border-forest-600 text-forest-700 dark:border-forest-400 dark:text-forest-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                <div className="p-4">
                  <VolumeBarChart
                    data={chartData}
                    title={`Otprema – ${TABS.find(t => t.id === activeTab)?.label} (m³)`}
                    height={280}
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/60">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Period</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Br. otprema</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Četinari (m³)</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lišćari (m³)</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ukupno (m³)</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Udio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {periodData[activeTab].map(row => (
                        <tr key={row.sortKey} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.label}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.count}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.cetinari)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.liscare)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100">{formatNumber(row.ukupno)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                            {totalUkupno > 0 ? ((row.ukupno / totalUkupno) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                      {periodData[activeTab].length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Nema podataka.</td></tr>
                      )}
                    </tbody>
                    {periodData[activeTab].length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 font-semibold">
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">Ukupno</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {periodData[activeTab].reduce((s, r) => s + r.count, 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {formatNumber(periodData[activeTab].reduce((s, r) => s + r.cetinari, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {formatNumber(periodData[activeTab].reduce((s, r) => s + r.liscare, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">
                            {formatNumber(periodData[activeTab].reduce((s, r) => s + r.ukupno, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500">100%</td>
                        </tr>
                      </tfoot>
                    )}
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
