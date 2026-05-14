import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { useSheet } from '@/context/SheetContext'
import { cn, formatNumber } from '@/lib/utils'

// ── Plan data from BosanskaKrupa_Plan2025_FINAL_1.xlsx ───────────────────────
// Keys: neto (m³), cTrupci, dzgo (cjepano č), lTrupci, cijepano (cjepano l)
// Mapping: Trupci Č → plan col J, DZGO → col K (cjepano č), Trupci L → col N, Cijepano → col O

const PLAN: Record<string, { neto: number; cTrupci: number; dzgo: number; lTrupci: number; cijepano: number }> = {
  '4/1':   { neto: 2117, cTrupci: 0,    dzgo: 0,   lTrupci: 303,  cijepano: 1814 },
  '11P':   { neto: 179,  cTrupci: 0,    dzgo: 0,   lTrupci: 73,   cijepano: 106  },
  '13':    { neto: 2768, cTrupci: 3,    dzgo: 2,   lTrupci: 875,  cijepano: 1888 },
  '15':    { neto: 383,  cTrupci: 0,    dzgo: 0,   lTrupci: 0,    cijepano: 383  },
  '21P':   { neto: 624,  cTrupci: 0,    dzgo: 0,   lTrupci: 202,  cijepano: 422  },
  '25':    { neto: 637,  cTrupci: 0,    dzgo: 0,   lTrupci: 0,    cijepano: 637  },
  '35':    { neto: 4648, cTrupci: 122,  dzgo: 44,  lTrupci: 1813, cijepano: 2670 },
  '43P':   { neto: 740,  cTrupci: 40,   dzgo: 100, lTrupci: 160,  cijepano: 440  },
  '50':    { neto: 4329, cTrupci: 1824, dzgo: 227, lTrupci: 971,  cijepano: 1307 },
  '54P':   { neto: 1276, cTrupci: 639,  dzgo: 109, lTrupci: 208,  cijepano: 320  },
  '55':    { neto: 4258, cTrupci: 2193, dzgo: 328, lTrupci: 789,  cijepano: 948  },
  '56':    { neto: 3206, cTrupci: 1779, dzgo: 263, lTrupci: 439,  cijepano: 725  },
  '59/1':  { neto: 3087, cTrupci: 1545, dzgo: 208, lTrupci: 658,  cijepano: 676  },
  '60':    { neto: 3061, cTrupci: 295,  dzgo: 65,  lTrupci: 1050, cijepano: 1651 },
  '61':    { neto: 4105, cTrupci: 454,  dzgo: 102, lTrupci: 1393, cijepano: 2156 },
  '63':    { neto: 3339, cTrupci: 1309, dzgo: 236, lTrupci: 796,  cijepano: 998  },
  '64/2P': { neto: 608,  cTrupci: 13,   dzgo: 23,  lTrupci: 211,  cijepano: 361  },
  '66':    { neto: 6800, cTrupci: 0,    dzgo: 52,  lTrupci: 1974, cijepano: 4775 },
  '67':    { neto: 4199, cTrupci: 0,    dzgo: 0,   lTrupci: 1530, cijepano: 2669 },
  '68/2':  { neto: 2287, cTrupci: 35,   dzgo: 6,   lTrupci: 1012, cijepano: 1234 },
  '69P':   { neto: 1204, cTrupci: 82,   dzgo: 32,  lTrupci: 390,  cijepano: 700  },
  '71P':   { neto: 1655, cTrupci: 664,  dzgo: 114, lTrupci: 401,  cijepano: 476  },
  '85P':   { neto: 418,  cTrupci: 0,    dzgo: 73,  lTrupci: 25,   cijepano: 320  },
  '88P':   { neto: 1200, cTrupci: 0,    dzgo: 0,   lTrupci: 20,   cijepano: 1180 },
  '97':    { neto: 4058, cTrupci: 1253, dzgo: 236, lTrupci: 901,  cijepano: 1668 },
  '113P':  { neto: 4300, cTrupci: 225,  dzgo: 74,  lTrupci: 1278, cijepano: 2723 },
}

// Normalize odjel key for matching (uppercase)
function normOdjel(s: string) { return s.trim().toUpperCase() }

// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = {
  cTrupci:  { plan: '#1e40af', actual: '#60a5fa' },
  dzgo:     { plan: '#7c3aed', actual: '#c084fc' },
  lTrupci:  { plan: '#15803d', actual: '#4ade80' },
  cijepano: { plan: '#b45309', actual: '#fbbf24' },
}
const LABELS = {
  cTrupci: 'Trupci Č', dzgo: 'DZGO', lTrupci: 'Trupci L', cijepano: 'Cijepano',
}

type SortKey = 'odjel' | 'plan' | 'ostvareno' | 'stepen'
type TabKey = 'grupe' | 'sortimenti'

// ── Realization badge ─────────────────────────────────────────────────────────
function RealizacijaBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
    pct >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
    pct > 0   ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
  return (
    <span className={cn('inline-block px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums', cls)}>
      {pct > 0 ? `${pct.toFixed(1)}%` : '—'}
    </span>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = '#15803d' }: { pct: number; color?: string }) {
  const w = Math.min(pct, 100)
  const over = pct > 100
  return (
    <div className="relative h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${w}%`, backgroundColor: over ? '#dc2626' : color }}
      />
    </div>
  )
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SortimentCard({
  label, plan, actual, color,
}: { label: string; plan: number; actual: number; color: string }) {
  const pct = plan > 0 ? (actual / plan) * 100 : 0
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
        <RealizacijaBadge pct={pct} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tabular-nums" style={{ color }}>{formatNumber(actual, 0)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">od {formatNumber(plan, 0)} m³ plana</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Ostalo</p>
          <p className="text-sm font-semibold tabular-nums text-gray-600 dark:text-gray-300">
            {formatNumber(Math.max(0, plan - actual), 0)} m³
          </p>
        </div>
      </div>
      <ProgressBar pct={pct} color={color} />
    </div>
  )
}

// ── Custom tooltip for grouped chart ─────────────────────────────────────────
function GroupTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Odjel {label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 flex-1">{p.name}:</span>
          <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">{formatNumber(p.value, 0)} m³</span>
        </div>
      ))}
    </div>
  )
}

// ── Tab 1: Po grupama ─────────────────────────────────────────────────────────
function PoGrupama({ odjeliData }: {
  odjeliData: Array<{
    odjel: string
    plan: { cTrupci: number; dzgo: number; lTrupci: number; cijepano: number; neto: number }
    actual: { cTrupci: number; dzgo: number; lTrupci: number; cijepano: number; ukupno: number }
  }>
}) {
  const [sortCol, setSortCol] = useState<SortKey>('plan')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    return [...odjeliData].sort((a, b) => {
      let va = 0, vb = 0
      if (sortCol === 'odjel') return sortAsc ? a.odjel.localeCompare(b.odjel) : b.odjel.localeCompare(a.odjel)
      if (sortCol === 'plan')       { va = a.plan.neto;       vb = b.plan.neto }
      if (sortCol === 'ostvareno')  { va = a.actual.ukupno;   vb = b.actual.ukupno }
      if (sortCol === 'stepen')     {
        va = a.plan.neto > 0 ? a.actual.ukupno / a.plan.neto * 100 : 0
        vb = b.plan.neto > 0 ? b.actual.ukupno / b.plan.neto * 100 : 0
      }
      return sortAsc ? va - vb : vb - va
    })
  }, [odjeliData, sortCol, sortAsc])

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(false) }
  }

  // Chart data — top 15 by plan neto, sorted ascending for horizontal bar
  const chartData = useMemo(() =>
    [...odjeliData]
      .sort((a, b) => a.plan.neto - b.plan.neto)
      .slice(-15)
      .map(d => ({
        odjel: d.odjel,
        'Plan Trupci Č': d.plan.cTrupci,
        'Plan DZGO': d.plan.dzgo,
        'Plan Trupci L': d.plan.lTrupci,
        'Plan Cijepano': d.plan.cijepano,
        'Ostvareno Trupci Č': d.actual.cTrupci,
        'Ostvareno DZGO': d.actual.dzgo,
        'Ostvareno Trupci L': d.actual.lTrupci,
        'Ostvareno Cijepano': d.actual.cijepano,
      }))
  , [odjeliData])

  const Th = ({ col, children }: { col: SortKey; children: React.ReactNode }) => (
    <th onClick={() => handleSort(col)}
      className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none whitespace-nowrap">
      <span className="flex items-center justify-end gap-1">
        {children}
        {sortCol === col ? (sortAsc ? '↑' : '↓') : <span className="opacity-30">↕</span>}
      </span>
    </th>
  )

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Plan po grupama sortimenata — top 15 odjela</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Planirane mase po skupinama, sortirano po ukupnom planu</p>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 30)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="odjel" width={55}
                tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} />
              <Tooltip content={p => <GroupTooltip {...p} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(v: string) => <span style={{ color: '#6b7280' }}>{v}</span>} />
              <Bar dataKey="Plan Trupci Č"  stackId="plan"   fill={COLORS.cTrupci.plan}   maxBarSize={12} />
              <Bar dataKey="Plan DZGO"       stackId="plan"   fill={COLORS.dzgo.plan}      maxBarSize={12} />
              <Bar dataKey="Plan Trupci L"   stackId="plan"   fill={COLORS.lTrupci.plan}   maxBarSize={12} />
              <Bar dataKey="Plan Cijepano"   stackId="plan"   fill={COLORS.cijepano.plan}  maxBarSize={12} />
              <Bar dataKey="Ostvareno Trupci Č" stackId="actual" fill={COLORS.cTrupci.actual}  maxBarSize={12} />
              <Bar dataKey="Ostvareno DZGO"      stackId="actual" fill={COLORS.dzgo.actual}     maxBarSize={12} />
              <Bar dataKey="Ostvareno Trupci L"  stackId="actual" fill={COLORS.lTrupci.actual}  maxBarSize={12} />
              <Bar dataKey="Ostvareno Cijepano"  stackId="actual" fill={COLORS.cijepano.actual} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Detalji po odjelima</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Plan / Ostvareno po sortimentnim grupama</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-8">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600"
                  onClick={() => handleSort('odjel')}>
                  Odjel {sortCol === 'odjel' ? (sortAsc ? '↑' : '↓') : <span className="opacity-30">↕</span>}
                </th>
                <th colSpan={2} className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider whitespace-nowrap border-l border-gray-200 dark:border-gray-700"
                  style={{ color: COLORS.cTrupci.plan }}>Trupci Č</th>
                <th colSpan={2} className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider whitespace-nowrap border-l border-gray-200 dark:border-gray-700"
                  style={{ color: COLORS.dzgo.plan }}>DZGO</th>
                <th colSpan={2} className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider whitespace-nowrap border-l border-gray-200 dark:border-gray-700"
                  style={{ color: COLORS.lTrupci.plan }}>Trupci L</th>
                <th colSpan={2} className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider whitespace-nowrap border-l border-gray-200 dark:border-gray-700"
                  style={{ color: COLORS.cijepano.plan }}>Cijepano</th>
                <Th col="plan">Plan m³</Th>
                <Th col="ostvareno">Ostvareno m³</Th>
                <Th col="stepen">Stepen</Th>
              </tr>
              <tr className="bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                <td /><td />
                <td className="px-3 py-1 text-right border-l border-gray-200 dark:border-gray-700">Plan</td>
                <td className="px-3 py-1 text-right">Ostvareno</td>
                <td className="px-3 py-1 text-right border-l border-gray-200 dark:border-gray-700">Plan</td>
                <td className="px-3 py-1 text-right">Ostvareno</td>
                <td className="px-3 py-1 text-right border-l border-gray-200 dark:border-gray-700">Plan</td>
                <td className="px-3 py-1 text-right">Ostvareno</td>
                <td className="px-3 py-1 text-right border-l border-gray-200 dark:border-gray-700">Plan</td>
                <td className="px-3 py-1 text-right">Ostvareno</td>
                <td /><td /><td />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((row, idx) => {
                const stepen = row.plan.neto > 0 ? row.actual.ukupno / row.plan.neto * 100 : 0
                return (
                  <tr key={row.odjel} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-3 py-2 text-gray-400 text-xs tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">{row.odjel}</td>
                    {/* Trupci Č */}
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-gray-800 whitespace-nowrap">{formatNumber(row.plan.cTrupci, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color: COLORS.cTrupci.actual }}>
                      {row.actual.cTrupci > 0 ? formatNumber(row.actual.cTrupci, 0) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    {/* DZGO */}
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-gray-800 whitespace-nowrap">{formatNumber(row.plan.dzgo, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color: COLORS.dzgo.actual }}>
                      {row.actual.dzgo > 0 ? formatNumber(row.actual.dzgo, 0) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    {/* Trupci L */}
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-gray-800 whitespace-nowrap">{formatNumber(row.plan.lTrupci, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color: COLORS.lTrupci.actual }}>
                      {row.actual.lTrupci > 0 ? formatNumber(row.actual.lTrupci, 0) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    {/* Cijepano */}
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 border-l border-gray-100 dark:border-gray-800 whitespace-nowrap">{formatNumber(row.plan.cijepano, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color: COLORS.cijepano.actual }}>
                      {row.actual.cijepano > 0 ? formatNumber(row.actual.cijepano, 0) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    {/* Totals */}
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatNumber(row.plan.neto, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatNumber(row.actual.ukupno, 0)}</td>
                    <td className="px-3 py-2 text-right"><RealizacijaBadge pct={stepen} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: Po sortimentima ────────────────────────────────────────────────────
function PoSortimentima({ odjeliData, totals }: {
  odjeliData: Array<{
    odjel: string
    plan: { cTrupci: number; dzgo: number; lTrupci: number; cijepano: number; neto: number }
    actual: { cTrupci: number; dzgo: number; lTrupci: number; cijepano: number; ukupno: number }
  }>
  totals: { planCTrupci: number; planDzgo: number; planLTrupci: number; planCijepano: number; planNeto: number; actCTrupci: number; actDzgo: number; actLTrupci: number; actCijepano: number; actUkupno: number }
}) {
  const [sortCol, setSortCol] = useState<'odjel' | 'stepen'>('stepen')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() =>
    [...odjeliData].sort((a, b) => {
      if (sortCol === 'odjel') return sortAsc ? a.odjel.localeCompare(b.odjel) : b.odjel.localeCompare(a.odjel)
      const sa = a.plan.neto > 0 ? a.actual.ukupno / a.plan.neto * 100 : 0
      const sb = b.plan.neto > 0 ? b.actual.ukupno / b.plan.neto * 100 : 0
      return sortAsc ? sa - sb : sb - sa
    })
  , [odjeliData, sortCol, sortAsc])

  // Horizontal bar chart: stepen realizacije per odjel
  const chartData = useMemo(() =>
    [...odjeliData]
      .filter(d => d.plan.neto > 0)
      .map(d => ({
        odjel: d.odjel,
        'Trupci Č': d.plan.cTrupci > 0 ? +(d.actual.cTrupci / d.plan.cTrupci * 100).toFixed(1) : 0,
        'DZGO':     d.plan.dzgo    > 0 ? +(d.actual.dzgo    / d.plan.dzgo    * 100).toFixed(1) : 0,
        'Trupci L': d.plan.lTrupci > 0 ? +(d.actual.lTrupci / d.plan.lTrupci * 100).toFixed(1) : 0,
        'Cijepano': d.plan.cijepano> 0 ? +(d.actual.cijepano/ d.plan.cijepano* 100).toFixed(1) : 0,
        'Ukupno':   d.plan.neto    > 0 ? +(d.actual.ukupno  / d.plan.neto    * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => a.Ukupno - b.Ukupno)
      .slice(-20)
  , [odjeliData])

  function handleSort(col: 'odjel' | 'stepen') {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(false) }
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SortimentCard label="Trupci Č" plan={totals.planCTrupci} actual={totals.actCTrupci} color={COLORS.cTrupci.plan} />
        <SortimentCard label="DZGO" plan={totals.planDzgo} actual={totals.actDzgo} color={COLORS.dzgo.plan} />
        <SortimentCard label="Trupci L" plan={totals.planLTrupci} actual={totals.actLTrupci} color={COLORS.lTrupci.plan} />
        <SortimentCard label="Cijepano" plan={totals.planCijepano} actual={totals.actCijepano} color={COLORS.cijepano.plan} />
      </div>

      {/* Overall progress */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ukupna realizacija godišnjeg plana</h3>
            <p className="text-xs text-gray-400 mt-0.5">Plan: {formatNumber(totals.planNeto, 0)} m³ neto · Ostvareno: {formatNumber(totals.actUkupno, 0)} m³</p>
          </div>
          <RealizacijaBadge pct={totals.planNeto > 0 ? totals.actUkupno / totals.planNeto * 100 : 0} />
        </div>
        <ProgressBar
          pct={totals.planNeto > 0 ? totals.actUkupno / totals.planNeto * 100 : 0}
          color="#15803d"
        />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([ ['Trupci Č', totals.planCTrupci, totals.actCTrupci, COLORS.cTrupci.plan],
              ['DZGO',     totals.planDzgo,    totals.actDzgo,    COLORS.dzgo.plan],
              ['Trupci L', totals.planLTrupci, totals.actLTrupci, COLORS.lTrupci.plan],
              ['Cijepano', totals.planCijepano,totals.actCijepano,COLORS.cijepano.plan],
          ] as [string, number, number, string][]).map(([label, plan, act, col]) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium" style={{ color: col }}>{label}</span>
                <span className="text-gray-400">{plan > 0 ? `${(act/plan*100).toFixed(1)}%` : '—'}</span>
              </div>
              <ProgressBar pct={plan > 0 ? act/plan*100 : 0} color={col} />
            </div>
          ))}
        </div>
      </div>

      {/* Stepen realizacije chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Stepen realizacije po odjelima</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">% ostvarenja plana po sortimentnim grupama, top 20 odjela</p>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" domain={[0, 'auto']}
                tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="odjel" width={55}
                tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(v: string) => <span style={{ color: '#6b7280' }}>{v}</span>} />
              <Bar dataKey="Trupci Č" fill={COLORS.cTrupci.plan}  maxBarSize={10} />
              <Bar dataKey="DZGO"     fill={COLORS.dzgo.plan}     maxBarSize={10} />
              <Bar dataKey="Trupci L" fill={COLORS.lTrupci.plan}  maxBarSize={10} />
              <Bar dataKey="Cijepano" fill={COLORS.cijepano.plan} maxBarSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Projektovana masa i stepen realizacije po sortimentima</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-8">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600"
                  onClick={() => handleSort('odjel')}>
                  Odjel {sortCol === 'odjel' ? (sortAsc ? '↑' : '↓') : <span className="opacity-30">↕</span>}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Plan neto m³</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Ostvareno m³</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 whitespace-nowrap"
                  onClick={() => handleSort('stepen')}>
                  Stepen {sortCol === 'stepen' ? (sortAsc ? '↑' : '↓') : <span className="opacity-30">↕</span>}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: COLORS.cTrupci.plan }}>Trupci Č %</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: COLORS.dzgo.plan }}>DZGO %</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: COLORS.lTrupci.plan }}>Trupci L %</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: COLORS.cijepano.plan }}>Cijepano %</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((row, idx) => {
                const stepen = row.plan.neto > 0 ? row.actual.ukupno / row.plan.neto * 100 : 0
                const pct = (a: number, p: number) => p > 0 ? (a / p * 100) : null
                return (
                  <tr key={row.odjel} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-3 py-2 text-gray-400 text-xs tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">{row.odjel}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatNumber(row.plan.neto, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{formatNumber(row.actual.ukupno, 0)}</td>
                    <td className="px-3 py-2 text-right"><RealizacijaBadge pct={stepen} /></td>
                    {([
                      ['cTrupci', 'cTrupci'] as const,
                      ['dzgo',    'dzgo']    as const,
                      ['lTrupci', 'lTrupci'] as const,
                      ['cijepano','cijepano'] as const,
                    ]).map(([planK, actK]) => {
                      const p = row.plan[planK as keyof typeof row.plan] as number
                      const a = row.actual[actK as keyof typeof row.actual] as number
                      const v = pct(a, p)
                      return (
                        <td key={planK} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {v !== null && p > 0
                            ? <RealizacijaBadge pct={v} />
                            : <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 w-24">
                      <ProgressBar pct={stepen} color="#15803d" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GodišnjiPlan() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [activeTab, setActiveTab] = useState<TabKey>('grupe')

  // All 2025 primka rows
  const rows2025 = useMemo(() =>
    primkaRows.filter(r => r.datum.getFullYear() === 2025)
  , [primkaRows])

  // Aggregate actual by odjel (normalized uppercase)
  const actualByOdjel = useMemo(() => {
    const map = new Map<string, { cTrupci: number; dzgo: number; lTrupci: number; cijepano: number; ukupno: number }>()
    for (const r of rows2025) {
      const key = normOdjel(r.odjel)
      const e = map.get(key)
      const cTrupci  = r.trupci_c
      const dzgo     = r.cel_duga + r.cel_cijepana
      const lTrupci  = r.trupci_l
      const cijepano = r.ogr_dugi + r.ogr_cijepani + r.gule
      const ukupno   = r.ukupno
      if (e) {
        e.cTrupci += cTrupci; e.dzgo += dzgo; e.lTrupci += lTrupci
        e.cijepano += cijepano; e.ukupno += ukupno
      } else {
        map.set(key, { cTrupci, dzgo, lTrupci, cijepano, ukupno })
      }
    }
    return map
  }, [rows2025])

  const odjeliData = useMemo(() =>
    Object.entries(PLAN).map(([odjel, plan]) => {
      const actual = actualByOdjel.get(normOdjel(odjel)) ?? { cTrupci: 0, dzgo: 0, lTrupci: 0, cijepano: 0, ukupno: 0 }
      return { odjel, plan, actual }
    })
  , [actualByOdjel])

  const totals = useMemo(() => {
    const sum = (arr: typeof odjeliData, k: keyof typeof arr[0]['plan']) => arr.reduce((s, d) => s + (d.plan[k] as number), 0)
    const actSum = (arr: typeof odjeliData, k: keyof typeof arr[0]['actual']) => arr.reduce((s, d) => s + (d.actual[k] as number), 0)
    return {
      planCTrupci: sum(odjeliData, 'cTrupci'),
      planDzgo:    sum(odjeliData, 'dzgo'),
      planLTrupci: sum(odjeliData, 'lTrupci'),
      planCijepano:sum(odjeliData, 'cijepano'),
      planNeto:    sum(odjeliData, 'neto'),
      actCTrupci:  actSum(odjeliData, 'cTrupci'),
      actDzgo:     actSum(odjeliData, 'dzgo'),
      actLTrupci:  actSum(odjeliData, 'lTrupci'),
      actCijepano: actSum(odjeliData, 'cijepano'),
      actUkupno:   actSum(odjeliData, 'ukupno'),
    }
  }, [odjeliData])

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju podataka</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={refetch} className="text-sm font-medium text-red-700 dark:text-red-400 underline hover:no-underline">Pokušaj ponovo</button>
      </div>
    )
  }

  const tabs: { id: TabKey; label: string }[] = [
    { id: 'grupe',      label: 'Po grupama' },
    { id: 'sortimenti', label: 'Po sortimentima' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Godišnji plan 2025</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Revidirani plan rada — Pogon Bosanska Krupa · {Object.keys(PLAN).length} odjela · ukupno {formatNumber(totals.planNeto, 0)} m³ neto
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === id
                ? 'border-forest-600 text-forest-700 dark:text-forest-400 dark:border-forest-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            )}>
            {label}
          </button>
        ))}
        {loading && <span className="ml-3 text-xs text-gray-400 animate-pulse">Učitavanje...</span>}
      </div>

      {/* Content */}
      {activeTab === 'grupe'
        ? <PoGrupama odjeliData={odjeliData} />
        : <PoSortimentima odjeliData={odjeliData} totals={totals} />
      }
    </div>
  )
}
