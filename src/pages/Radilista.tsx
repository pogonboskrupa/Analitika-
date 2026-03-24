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
  aggregateRadilisteSummary,
  aggregateIzvođačSummary,
  formatNumber,
} from '@/lib/utils'
import type { DateRange } from '@/lib/types'

export default function Radilista() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])

  const radilisteSummaries = useMemo(() => aggregateRadilisteSummary(filtered), [filtered])
  const izvođačSummaries = useMemo(() => aggregateIzvođačSummary(filtered), [filtered])

  const top10Radilista = useMemo(() =>
    radilisteSummaries.slice(0, 10).map(r => ({
      name: r.radiliste, cetinari: r.totalCetinari, liscare: r.totalLiscare, ukupno: r.totalUkupno,
    })), [radilisteSummaries])

  const top10Izvođači = useMemo(() =>
    izvođačSummaries.slice(0, 10).map(i => ({
      name: i.izvođač, cetinari: i.totalCetinari, liscare: i.totalLiscare, ukupno: i.totalUkupno,
    })), [izvođačSummaries])

  const totalRadilistaUkupno = radilisteSummaries.reduce((s, r) => s + r.totalUkupno, 0)
  const totalIzvođačUkupno = izvođačSummaries.reduce((s, i) => s + i.totalUkupno, 0)

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Radilišta &amp; Izvođači</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pregled radilišta i izvođača radova
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
        <PrintButton />
      </div>

      {loading && filtered.length === 0 ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Radilišta section */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Radilišta</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatsCard title="Broj radilišta" value={radilisteSummaries.length} unit="" decimals={0}
              icon={<LocationIcon />} description="jedinstvenih radilišta" />
            <StatsCard title="Ukupno m³" value={totalRadilistaUkupno} unit="m³"
              icon={<CubeIcon />} description="sječa na radilištima" />
          </div>

          <VolumeBarChart data={top10Radilista} title="Top 10 radilišta po volumenu (m³)" height={300} />

          {radilisteSummaries.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pregled po radilištima</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Radilište</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Br. primki</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Četinari (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lišćari (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ukupno (m³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {radilisteSummaries.map((row, i) => (
                      <tr key={row.radiliste} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.radiliste}</td>
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

          {/* Izvođači section */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Izvođači</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatsCard title="Broj izvođača" value={izvođačSummaries.length} unit="" decimals={0}
              icon={<ToolsIcon />} description="jedinstvenih izvođača" />
            <StatsCard title="Ukupno m³" value={totalIzvođačUkupno} unit="m³"
              icon={<CubeIcon />} description="sječa od izvođača" />
          </div>

          <VolumeBarChart data={top10Izvođači} title="Top 10 izvođača po volumenu (m³)" height={300} />

          {izvođačSummaries.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pregled po izvođačima</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Izvođač</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Br. primki</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Četinari (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lišćari (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ukupno (m³)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {izvođačSummaries.map((row, i) => (
                      <tr key={row.izvođač} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.izvođač}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.count}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalCetinari)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.totalLiscare)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100">{formatNumber(row.totalUkupno)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            to={`/radilista/izvođač/${encodeURIComponent(row.izvođač)}`}
                            className="text-xs font-medium text-forest-600 dark:text-forest-400 hover:underline whitespace-nowrap"
                          >
                            Detalji →
                          </Link>
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
    </div>
  )
}

const LocationIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
)
const ToolsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)
const CubeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
)
