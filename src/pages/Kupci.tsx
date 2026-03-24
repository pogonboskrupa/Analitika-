import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { StatsCard } from '@/components/StatsCard'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import { PrintButton } from '@/components/PrintButton'
import {
  getQuickSelectRange,
  filterByDateRange,
  aggregateKupacSummary,
  getTotalOtpremaUkupno,
  getTotalOtpremaCetinari,
  getTotalOtpremaLiscare,
  formatNumber,
} from '@/lib/utils'
import type { DateRange } from '@/lib/types'

export default function Kupci() {
  const { otpremaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => filterByDateRange(otpremaRows, range), [otpremaRows, range])
  const summaries = useMemo(() => aggregateKupacSummary(filtered), [filtered])

  const displayed = useMemo(() => {
    if (!search.trim()) return summaries
    const q = search.toLowerCase()
    return summaries.filter(s => s.kupac.toLowerCase().includes(q))
  }, [summaries, search])

  const totalUkupno = getTotalOtpremaUkupno(filtered)
  const totalCetinari = getTotalOtpremaCetinari(filtered)
  const totalLiscare = getTotalOtpremaLiscare(filtered)

  const top10 = useMemo(() =>
    summaries.slice(0, 10).map(k => ({
      name: k.kupac, cetinari: k.totalCetinari, liscare: k.totalLiscare, ukupno: k.totalUkupno,
    })), [summaries])

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju podataka</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline hover:no-underline">Pokušaj ponovo</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Kupci</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pregled svih kupaca drvnih sortimenata</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
        <PrintButton />
      </div>

      {loading && filtered.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard title="Broj kupaca" value={summaries.length} unit="" decimals={0}
              icon={<BuyerIcon />} description="jedinstvenih kupaca" />
            <StatsCard title="Ukupno otpremljeno" value={totalUkupno} unit="m³"
              icon={<TruckIcon />} />
            <StatsCard title="Četinari" value={totalCetinari} unit="m³"
              description={`${totalUkupno > 0 ? ((totalCetinari / totalUkupno) * 100).toFixed(1) : 0}%`} />
            <StatsCard title="Lišćari" value={totalLiscare} unit="m³"
              description={`${totalUkupno > 0 ? ((totalLiscare / totalUkupno) * 100).toFixed(1) : 0}%`} />
          </div>

          <VolumeBarChart data={top10} title="Top 10 kupaca po volumenu (m³)" height={300} />

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <input
                type="search"
                placeholder="Pretraži kupce..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full sm:w-72 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                    <th className="pl-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Kupac</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Br. otprema</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Četinari (m³)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lišćari (m³)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ukupno (m³)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {displayed.map((row, i) => (
                    <tr key={row.kupac} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="pl-4 py-3 text-gray-400 dark:text-gray-500 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{row.kupac || <span className="text-gray-400 italic">—</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalCetinari)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalLiscare)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatNumber(row.totalUkupno)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/kupci/${encodeURIComponent(row.kupac)}`}
                          className="text-xs font-medium text-forest-600 dark:text-forest-400 hover:underline whitespace-nowrap"
                        >
                          Detalji →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {displayed.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">Nema podataka.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const BuyerIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
