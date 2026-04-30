import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useSheet } from '@/context/SheetContext'
import { DateRangePicker } from '@/components/DateRangePicker'
import { PrintButton } from '@/components/PrintButton'
import { getQuickSelectRange, filterByDateRange, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DateRange, PrimkaRow } from '@/lib/types'

const GRADE_COLORS = {
  fl:     '#15803d',
  i:      '#1d4ed8',
  ii:     '#0284c7',
  iii:    '#ca8a04',
  trupci: '#ea580c',
  ogr:    '#78716c',
}
const GRADE_LABELS = {
  fl: 'FL', i: 'I. kl.', ii: 'II. kl.', iii: 'III. kl.', trupci: 'Trupci', ogr: 'Ogrevno',
}
type GKey = keyof typeof GRADE_COLORS
type Species = 'sve' | 'cetinari' | 'liscare'

interface SortimentRow {
  name: string
  ukupno: number
  fl: number; i: number; ii: number; iii: number; trupci: number; ogr: number
  flAbs: number; iAbs: number; iiAbs: number; iiiAbs: number; trupciAbs: number; ogrAbs: number
  kvalitet: number
}

function computeBreakdown(rows: PrimkaRow[], groupBy: 'primac' | 'odjel', species: Species): SortimentRow[] {
  const map = new Map<string, { fl: number; i: number; ii: number; iii: number; trupci: number; ogr: number; ukupno: number }>()

  for (const row of rows) {
    const key = groupBy === 'primac' ? (row.primac || '—') : (row.odjel || '—')
    let fl: number, i: number, ii: number, iii: number, trupci: number, ogr: number, total: number

    if (species === 'cetinari') {
      fl = row.fl_c; i = row.i_c; ii = row.ii_c
      iii = row.iii_c + row.rd_c
      trupci = row.trupci_c
      ogr = row.cel_duga + row.cel_cijepana + row.skart
      total = row.sigma_cetinari
    } else if (species === 'liscare') {
      fl = row.fl_l; i = row.i_l; ii = row.ii_l
      iii = row.iii_l
      trupci = row.trupci_l
      ogr = row.ogr_dugi + row.ogr_cijepani + row.gule
      total = row.liscare
    } else {
      fl = row.fl_c + row.fl_l; i = row.i_c + row.i_l; ii = row.ii_c + row.ii_l
      iii = row.iii_c + row.iii_l + row.rd_c
      trupci = row.trupci_c + row.trupci_l
      ogr = row.cel_duga + row.cel_cijepana + row.ogr_dugi + row.ogr_cijepani + row.gule + row.skart
      total = row.ukupno
    }

    const e = map.get(key)
    if (e) { e.fl += fl; e.i += i; e.ii += ii; e.iii += iii; e.trupci += trupci; e.ogr += ogr; e.ukupno += total }
    else { map.set(key, { fl, i, ii, iii, trupci, ogr, ukupno: total }) }
  }

  const pct = (n: number, t: number) => t > 0 ? +((n / t) * 100).toFixed(1) : 0
  return Array.from(map.entries())
    .filter(([, v]) => v.ukupno > 0)
    .map(([name, v]) => ({
      name,
      ukupno: v.ukupno,
      fl: pct(v.fl, v.ukupno),     i: pct(v.i, v.ukupno),
      ii: pct(v.ii, v.ukupno),     iii: pct(v.iii, v.ukupno),
      trupci: pct(v.trupci, v.ukupno), ogr: pct(v.ogr, v.ukupno),
      flAbs: v.fl, iAbs: v.i, iiAbs: v.ii, iiiAbs: v.iii, trupciAbs: v.trupci, ogrAbs: v.ogr,
      kvalitet: pct(v.fl + v.i + v.ii, v.ukupno),
    }))
    .sort((a, b) => b.kvalitet - a.kvalitet)
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey: string; payload: SortimentRow }>
  label?: string
  species: Species
}
function ChartTooltip({ active, payload, label, species }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  const unitLabel = species === 'cetinari' ? 'čet. m³' : species === 'liscare' ? 'liš. m³' : 'm³'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2 truncate">{label}</p>
      <p className="text-gray-400 dark:text-gray-500 mb-1.5">
        Ukupno: <span className="font-medium text-gray-700 dark:text-gray-300">{formatNumber(row?.ukupno ?? 0)} {unitLabel}</span>
      </p>
      {(Object.keys(GRADE_COLORS) as GKey[]).map(k => {
        const pctVal = row?.[k] ?? 0
        if (pctVal === 0) return null
        const absVal = (row?.[`${k}Abs` as keyof SortimentRow] as number) ?? 0
        return (
          <div key={k} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: GRADE_COLORS[k] }} />
            <span className="text-gray-500 dark:text-gray-400 flex-1">{GRADE_LABELS[k]}:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{pctVal}%</span>
            <span className="text-gray-400 dark:text-gray-500 tabular-nums">({formatNumber(absVal)})</span>
          </div>
        )
      })}
    </div>
  )
}

function KvalitetBadge({ score }: { score: number }) {
  const cls = score >= 60
    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
    : score >= 35
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  return (
    <span className={cn('inline-block px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums', cls)}>
      {score.toFixed(1)}%
    </span>
  )
}

function StackChart({ data, nameWidth = 140, species }: { data: SortimentRow[]; nameWidth?: number; species: Species }) {
  const chartHeight = Math.max(260, data.length * 38)
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number" domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false} axisLine={false}
          tickFormatter={v => `${v}%`}
        />
        <YAxis
          type="category" dataKey="name" width={nameWidth}
          tick={{ fontSize: 11, fill: '#374151' }}
          tickLine={false} axisLine={false}
        />
        <Tooltip content={(props) => <ChartTooltip {...props} species={species} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={(v: string) => <span style={{ color: '#6b7280' }}>{v}</span>}
        />
        {(Object.keys(GRADE_COLORS) as GKey[]).map(k => (
          <Bar key={k} dataKey={k} name={GRADE_LABELS[k]} stackId="a" fill={GRADE_COLORS[k]} maxBarSize={26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function SortimentTable({ data, nameLabel, species }: { data: SortimentRow[]; nameLabel: string; species: Species }) {
  const [sortCol, setSortCol] = useState<'ukupno' | 'kvalitet' | GKey>('kvalitet')
  const [sortAsc, setSortAsc] = useState(false)
  const unitLabel = species === 'cetinari' ? 'čet. m³' : species === 'liscare' ? 'liš. m³' : 'm³'

  const sorted = useMemo(() =>
    [...data].sort((a, b) => {
      const va = a[sortCol] as number, vb = b[sortCol] as number
      return sortAsc ? va - vb : vb - va
    }),
    [data, sortCol, sortAsc]
  )

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(false) }
  }

  const Th = ({ col, children }: { col: typeof sortCol; children: React.ReactNode }) => (
    <th onClick={() => handleSort(col)}
      className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
      <span className="flex items-center justify-end gap-1">
        {children}
        {sortCol === col ? (sortAsc ? '↑' : '↓') : <span className="opacity-30">↕</span>}
      </span>
    </th>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider w-8">#</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{nameLabel}</th>
            <Th col="ukupno">{unitLabel}</Th>
            <Th col="fl">FL %</Th>
            <Th col="i">I. kl. %</Th>
            <Th col="ii">II. kl. %</Th>
            <Th col="kvalitet">Kvalitet FL+I+II</Th>
            <Th col="iii">III. kl. %</Th>
            <Th col="trupci">Trupci %</Th>
            <Th col="ogr">Ogrevno %</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sorted.map((row, i) => (
            <tr key={row.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <td className="px-3 py-2 text-gray-400 dark:text-gray-500 tabular-nums text-xs">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 max-w-[180px] truncate" title={row.name}>{row.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.ukupno)}</td>
              <PctCell value={row.fl}     color={GRADE_COLORS.fl} />
              <PctCell value={row.i}      color={GRADE_COLORS.i} />
              <PctCell value={row.ii}     color={GRADE_COLORS.ii} />
              <td className="px-3 py-2 text-right"><KvalitetBadge score={row.kvalitet} /></td>
              <PctCell value={row.iii}    color={GRADE_COLORS.iii} />
              <PctCell value={row.trupci} color={GRADE_COLORS.trupci} />
              <PctCell value={row.ogr}    color={GRADE_COLORS.ogr} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PctCell({ value, color }: { value: number; color: string }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {value > 0
        ? <span className="font-medium" style={{ color }}>{value.toFixed(1)}%</span>
        : <span className="text-gray-300 dark:text-gray-700">—</span>}
    </td>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Poredenje() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))
  const [species, setSpecies] = useState<Species>('sve')
  const [selectedOdjel, setSelectedOdjel] = useState<string>('')

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])

  // Odjeli sorted by most-recent datum (freshest sječa first)
  const odjeliSorted = useMemo(() => {
    const lastDate = new Map<string, Date>()
    for (const row of primkaRows) {
      const o = row.odjel || ''
      if (!o) continue
      const cur = lastDate.get(o)
      if (!cur || row.datum > cur) lastDate.set(o, row.datum)
    }
    return Array.from(lastDate.entries())
      .sort(([, a], [, b]) => b.getTime() - a.getTime())
      .map(([odjel]) => odjel)
  }, [primkaRows])

  // Effective odjel: user pick or first (freshest) available
  const effectiveOdjel = selectedOdjel || odjeliSorted[0] || ''

  // Rows for selected odjel
  const odjelRows = useMemo(
    () => effectiveOdjel ? filtered.filter(r => r.odjel === effectiveOdjel) : filtered,
    [filtered, effectiveOdjel]
  )

  const primacInOdjelData = useMemo(
    () => computeBreakdown(odjelRows, 'primac', species),
    [odjelRows, species]
  )
  const odjelData = useMemo(
    () => computeBreakdown(filtered, 'odjel', species),
    [filtered, species]
  )

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju podataka</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline hover:no-underline">Pokušaj ponovo</button>
      </div>
    )
  }

  const speciesButtons: { id: Species; label: string }[] = [
    { id: 'sve',      label: 'Ukupno' },
    { id: 'cetinari', label: 'Četinari' },
    { id: 'liscare',  label: 'Lišćari' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Sortimentna struktura</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Procentualni udio klasa drvnih sortimenata — ko izvlači bolje klase
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
        <PrintButton />
      </div>

      {/* Species toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Vrsta drveta:</span>
        <div className="flex items-center gap-1">
          {speciesButtons.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSpecies(id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-150',
                species === id
                  ? 'bg-forest-600 text-white border-forest-600 dark:bg-forest-500 dark:border-forest-500'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-forest-400 hover:text-forest-600 dark:hover:text-forest-400'
              )}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {(Object.keys(GRADE_COLORS) as GKey[]).map(k => (
          <span key={k} className="flex items-center gap-1.5 font-medium" style={{ color: GRADE_COLORS[k] }}>
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: GRADE_COLORS[k] }} />
            {GRADE_LABELS[k]}
          </span>
        ))}
        <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
        <span className="text-gray-400 dark:text-gray-500">Sortirano po % kvalitetnih klasa (FL + I + II) ↓</span>
      </div>

      {loading && primacInOdjelData.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : (
        <>
          {/* ── Section 1: Primači unutar odjela (PRIMARY) ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Primači u odjelu
                  {effectiveOdjel && (
                    <span className="ml-1.5 text-forest-600 dark:text-forest-400">{effectiveOdjel}</span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {primacInOdjelData.length} primača · usporedi ko izvlači bolje klase unutar istog odjela
                </p>
              </div>
              {odjeliSorted.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Odjel:</label>
                  <select
                    value={effectiveOdjel}
                    onChange={e => setSelectedOdjel(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-forest-400"
                  >
                    {odjeliSorted.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>

            {primacInOdjelData.length === 0 ? (
              <p className="px-5 py-10 text-sm text-center text-gray-400 dark:text-gray-500">Nema podataka za odabrani odjel i period.</p>
            ) : (
              <>
                <div className="p-5">
                  <StackChart data={primacInOdjelData} nameWidth={160} species={species} />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <SortimentTable data={primacInOdjelData} nameLabel="Primač" species={species} />
                </div>
              </>
            )}
          </div>

          {/* ── Section 2: Po odjelima ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sortimentna struktura po odjelima</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {odjelData.length} odjela · sortirano po kvalitetu
              </p>
            </div>

            {odjelData.length === 0 ? (
              <p className="px-5 py-10 text-sm text-center text-gray-400 dark:text-gray-500">Nema podataka za odabrani period.</p>
            ) : (
              <>
                <div className="p-5">
                  <StackChart data={odjelData} nameWidth={120} species={species} />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <SortimentTable data={odjelData} nameLabel="Odjel" species={species} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
