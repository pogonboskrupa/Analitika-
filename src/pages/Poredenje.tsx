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

// ── Grade definitions ────────────────────────────────────────────────────────
// Quality classes (green→blue): FL, I, II, III
// Četinari firewood (purple): Cel. duga, Cel. cijepana
// Lišćari firewood (orange): Ogr. dugi, Ogr. cijepani, Gule
// "Trupci" field is folded into III (per user intent — same commercial class)

type GKey =
  | 'fl' | 'i' | 'ii' | 'iii'
  | 'cel_duga' | 'cel_cijepana'
  | 'ogr_dugi' | 'ogr_cijepani' | 'gule'

const GRADE_COLORS: Record<GKey, string> = {
  fl:           '#15803d',
  i:            '#1d4ed8',
  ii:           '#0284c7',
  iii:          '#ca8a04',
  cel_duga:     '#7c3aed',
  cel_cijepana: '#a855f7',
  ogr_dugi:     '#c2410c',
  ogr_cijepani: '#ea580c',
  gule:         '#fb923c',
}

const GRADE_LABELS: Record<GKey, string> = {
  fl:           'FL',
  i:            'I. kl.',
  ii:           'II. kl.',
  iii:          'III. kl.',
  cel_duga:     'Cel. duga',
  cel_cijepana: 'Cel. cijepana',
  ogr_dugi:     'Ogr. dugi',
  ogr_cijepani: 'Ogr. cijepani',
  gule:         'Gule',
}

const ABS_KEY: Record<GKey, string> = {
  fl: 'flAbs', i: 'iAbs', ii: 'iiAbs', iii: 'iiiAbs',
  cel_duga: 'cel_dugaAbs', cel_cijepana: 'cel_cijepanaAbs',
  ogr_dugi: 'ogr_dugiAbs', ogr_cijepani: 'ogr_cijepaniAbs', gule: 'guleAbs',
}

type Species = 'sve' | 'cetinari' | 'liscare'

function getDisplayKeys(species: Species): GKey[] {
  if (species === 'cetinari') return ['fl', 'i', 'ii', 'iii', 'cel_duga', 'cel_cijepana']
  if (species === 'liscare')  return ['fl', 'i', 'ii', 'iii', 'ogr_dugi', 'ogr_cijepani', 'gule']
  return ['fl', 'i', 'ii', 'iii', 'cel_duga', 'cel_cijepana', 'ogr_dugi', 'ogr_cijepani', 'gule']
}

// ── Data model ───────────────────────────────────────────────────────────────

interface SortimentRow {
  name: string; ukupno: number
  fl: number; i: number; ii: number; iii: number
  cel_duga: number; cel_cijepana: number
  ogr_dugi: number; ogr_cijepani: number; gule: number
  flAbs: number; iAbs: number; iiAbs: number; iiiAbs: number
  cel_dugaAbs: number; cel_cijepanaAbs: number
  ogr_dugiAbs: number; ogr_cijepaniAbs: number; guleAbs: number
  kvalitet: number
}

function computeBreakdown(rows: PrimkaRow[], groupBy: 'primac' | 'odjel', species: Species): SortimentRow[] {
  type Acc = {
    fl: number; i: number; ii: number; iii: number
    cel_duga: number; cel_cijepana: number
    ogr_dugi: number; ogr_cijepani: number; gule: number
    ukupno: number
  }
  const map = new Map<string, Acc>()

  for (const row of rows) {
    const key = groupBy === 'primac' ? (row.primac || '—') : (row.odjel || '—')

    let fl: number, i: number, ii: number, iii: number
    let cel_duga: number, cel_cijepana: number
    let ogr_dugi: number, ogr_cijepani: number, gule: number
    let total: number

    if (species === 'cetinari') {
      fl = row.fl_c;  i = row.i_c;  ii = row.ii_c
      // rd_c is a sub-class of četinari logs; trupci_c is the sheet SUM (fl+i+ii+iii+rd) — do NOT add it
      iii = row.iii_c + row.rd_c
      cel_duga = row.cel_duga;  cel_cijepana = row.cel_cijepana
      ogr_dugi = 0;  ogr_cijepani = 0;  gule = 0
      total = row.sigma_cetinari
    } else if (species === 'liscare') {
      fl = row.fl_l;  i = row.i_l;  ii = row.ii_l
      // trupci_l is the sheet SUM (fl+i+ii+iii) — do NOT add it to iii
      iii = row.iii_l
      cel_duga = 0;  cel_cijepana = 0
      ogr_dugi = row.ogr_dugi;  ogr_cijepani = row.ogr_cijepani;  gule = row.gule
      total = row.liscare
    } else {
      fl = row.fl_c + row.fl_l;  i = row.i_c + row.i_l;  ii = row.ii_c + row.ii_l
      // trupci_c and trupci_l are sheet SUM columns — do NOT add them
      iii = row.iii_c + row.iii_l + row.rd_c
      cel_duga = row.cel_duga;  cel_cijepana = row.cel_cijepana
      ogr_dugi = row.ogr_dugi;  ogr_cijepani = row.ogr_cijepani;  gule = row.gule
      total = row.ukupno
    }

    const e = map.get(key)
    if (e) {
      e.fl += fl; e.i += i; e.ii += ii; e.iii += iii
      e.cel_duga += cel_duga; e.cel_cijepana += cel_cijepana
      e.ogr_dugi += ogr_dugi; e.ogr_cijepani += ogr_cijepani; e.gule += gule
      e.ukupno += total
    } else {
      map.set(key, { fl, i, ii, iii, cel_duga, cel_cijepana, ogr_dugi, ogr_cijepani, gule, ukupno: total })
    }
  }

  const pct = (n: number, t: number) => t > 0 ? +((n / t) * 100).toFixed(1) : 0
  return Array.from(map.entries())
    .filter(([, v]) => v.ukupno > 0)
    .map(([name, v]) => ({
      name, ukupno: v.ukupno,
      fl: pct(v.fl, v.ukupno),  i: pct(v.i, v.ukupno),
      ii: pct(v.ii, v.ukupno),  iii: pct(v.iii, v.ukupno),
      cel_duga: pct(v.cel_duga, v.ukupno),  cel_cijepana: pct(v.cel_cijepana, v.ukupno),
      ogr_dugi: pct(v.ogr_dugi, v.ukupno),  ogr_cijepani: pct(v.ogr_cijepani, v.ukupno),
      gule: pct(v.gule, v.ukupno),
      flAbs: v.fl, iAbs: v.i, iiAbs: v.ii, iiiAbs: v.iii,
      cel_dugaAbs: v.cel_duga, cel_cijepanaAbs: v.cel_cijepana,
      ogr_dugiAbs: v.ogr_dugi, ogr_cijepaniAbs: v.ogr_cijepani, guleAbs: v.gule,
      kvalitet: pct(v.fl + v.i + v.ii, v.ukupno),
    }))
    .sort((a, b) => b.kvalitet - a.kvalitet)
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, displayKeys, species }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string; payload: SortimentRow }>
  label?: string
  displayKeys: GKey[]
  species: Species
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  const unit = species === 'cetinari' ? 'čet. m³' : species === 'liscare' ? 'liš. m³' : 'm³'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2 truncate">{label}</p>
      <p className="text-gray-400 dark:text-gray-500 mb-1.5">
        Ukupno: <span className="font-medium text-gray-700 dark:text-gray-300">{formatNumber(row?.ukupno ?? 0)} {unit}</span>
      </p>
      {displayKeys.map(k => {
        const pctVal = row?.[k] ?? 0
        if (pctVal === 0) return null
        const absVal = (row as unknown as Record<string, number>)[ABS_KEY[k]] ?? 0
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

function StackChart({ data, nameWidth = 140, displayKeys, species }: {
  data: SortimentRow[]
  nameWidth?: number
  displayKeys: GKey[]
  species: Species
}) {
  const chartHeight = Math.max(260, data.length * 38)
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false}
          tickFormatter={v => `${v}%`} />
        <YAxis type="category" dataKey="name" width={nameWidth}
          tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} />
        <Tooltip
          content={p => <ChartTooltip {...p} displayKeys={displayKeys} species={species} />}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={(v: string) => <span style={{ color: '#6b7280' }}>{v}</span>}
        />
        {displayKeys.map(k => (
          <Bar key={k} dataKey={k} name={GRADE_LABELS[k]} stackId="a"
            fill={GRADE_COLORS[k]} maxBarSize={26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function SortimentTable({ data, nameLabel, displayKeys, species }: {
  data: SortimentRow[]
  nameLabel: string
  displayKeys: GKey[]
  species: Species
}) {
  const [sortCol, setSortCol] = useState<string>('kvalitet')
  const [sortAsc, setSortAsc] = useState(false)

  const unit = species === 'cetinari' ? 'čet. m³' : species === 'liscare' ? 'liš. m³' : 'm³'

  const sorted = useMemo(() =>
    [...data].sort((a, b) => {
      const va = (a as unknown as Record<string, number>)[sortCol] ?? 0
      const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0
      return sortAsc ? va - vb : vb - va
    }),
    [data, sortCol, sortAsc]
  )

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(false) }
  }

  const Th = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th onClick={() => handleSort(col)}
      className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none whitespace-nowrap">
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
            <Th col="ukupno">{unit}</Th>
            {displayKeys.map(k => (
              <Th key={k} col={k}>
                <span style={{ color: GRADE_COLORS[k] }}>{GRADE_LABELS[k]}</span>
              </Th>
            ))}
            <Th col="kvalitet">Kvalitet FL+I+II</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sorted.map((row, idx) => (
            <tr key={row.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <td className="px-3 py-2 text-gray-400 dark:text-gray-500 tabular-nums text-xs">{idx + 1}</td>
              <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 max-w-[180px] truncate" title={row.name}>{row.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatNumber(row.ukupno)}</td>
              {displayKeys.map(k => (
                <td key={k} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {(row[k] as number) > 0
                    ? <span className="font-medium" style={{ color: GRADE_COLORS[k] }}>{(row[k] as number).toFixed(1)}%</span>
                    : <span className="text-gray-300 dark:text-gray-700">—</span>}
                </td>
              ))}
              <td className="px-3 py-2 text-right"><KvalitetBadge score={row.kvalitet} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Poredenje() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [range, setRange] = useState<DateRange>(() => getQuickSelectRange('ytd'))
  const [species, setSpecies] = useState<Species>('sve')
  const [selectedOdjel, setSelectedOdjel] = useState<string>('')

  const filtered = useMemo(() => filterByDateRange(primkaRows, range), [primkaRows, range])
  const displayKeys = useMemo(() => getDisplayKeys(species), [species])

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
      .map(([o]) => o)
  }, [primkaRows])

  const effectiveOdjel = selectedOdjel || odjeliSorted[0] || ''

  const odjelRows = useMemo(
    () => effectiveOdjel ? filtered.filter(r => r.odjel === effectiveOdjel) : filtered,
    [filtered, effectiveOdjel]
  )

  const primacData = useMemo(() => computeBreakdown(odjelRows, 'primac', species), [odjelRows, species])
  const odjelData  = useMemo(() => computeBreakdown(filtered, 'odjel', species),   [filtered, species])

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
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Vrsta:</span>
          <div className="flex items-center gap-1">
            {speciesButtons.map(({ id, label }) => (
              <button key={id} onClick={() => setSpecies(id)}
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

        {/* Dynamic legend for current species */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {displayKeys.map(k => (
            <span key={k} className="flex items-center gap-1.5 font-medium" style={{ color: GRADE_COLORS[k] }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GRADE_COLORS[k] }} />
              {GRADE_LABELS[k]}
            </span>
          ))}
        </div>
      </div>

      {loading && primacData.length === 0 ? (
        <div className="animate-pulse space-y-4">
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : (
        <>
          {/* ── Section 1: Primači unutar odjela ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Primači u odjelu
                  {effectiveOdjel && <span className="ml-1.5 text-forest-600 dark:text-forest-400">{effectiveOdjel}</span>}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {primacData.length} primača · ko izvlači bolje klase unutar istog odjela
                </p>
              </div>
              {odjeliSorted.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Odjel:</label>
                  <select value={effectiveOdjel} onChange={e => setSelectedOdjel(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-forest-400">
                    {odjeliSorted.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>

            {primacData.length === 0 ? (
              <p className="px-5 py-10 text-sm text-center text-gray-400 dark:text-gray-500">Nema podataka za odabrani odjel i period.</p>
            ) : (
              <>
                <div className="p-5">
                  <StackChart data={primacData} nameWidth={160} displayKeys={displayKeys} species={species} />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <SortimentTable data={primacData} nameLabel="Primač" displayKeys={displayKeys} species={species} />
                </div>
              </>
            )}
          </div>

          {/* ── Section 2: Po odjelima ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sortimentna struktura po odjelima</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {odjelData.length} odjela · sortirano po kvalitetu (FL + I + II) ↓
              </p>
            </div>

            {odjelData.length === 0 ? (
              <p className="px-5 py-10 text-sm text-center text-gray-400 dark:text-gray-500">Nema podataka za odabrani period.</p>
            ) : (
              <>
                <div className="p-5">
                  <StackChart data={odjelData} nameWidth={120} displayKeys={displayKeys} species={species} />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <SortimentTable data={odjelData} nameLabel="Odjel" displayKeys={displayKeys} species={species} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
