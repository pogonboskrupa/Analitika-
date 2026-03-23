import { useState, useMemo } from 'react'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { PrimaciTable } from '@/components/tables/PrimaciTable'
import {
  getQuickSelectRange,
  filterByDateRange,
  aggregatePrimacSummary,
} from '@/lib/utils'
import type { DateRange } from '@/lib/types'

export default function Primaci() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('30d'))

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const summaries = useMemo(() => aggregatePrimacSummary(filtered), [filtered])

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Primači</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pregled svih primača drvnih sortimenata
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
      </div>

      {loading && summaries.length === 0 ? (
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 dark:bg-gray-800 rounded-t-xl" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800" />
          ))}
        </div>
      ) : (
        <PrimaciTable data={summaries} />
      )}
    </div>
  )
}
