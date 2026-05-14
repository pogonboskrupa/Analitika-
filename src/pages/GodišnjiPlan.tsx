import { useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { useSheet } from '@/context/SheetContext'
import { cn, formatNumber } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
type GJ = 'Risovac Krupa' | 'Grmeč Jasenica' | 'Vojskova'
type StatusOverride = 'auto' | 'posjeceno' | 'u-sjeci' | 'planirano'
type StatusValue    = 'posjeceno' | 'u-sjeci' | 'planirano'
type TabKey = 'grupe' | 'sortimenti' | 'pregled'

interface PlanEntry {
  gj:       GJ
  odjel:    string
  bruto:    number
  neto:     number
  // Plan groups (from Excel):
  // cjepanoC = cel.duga + cel.cijepana + škart  (we call it dzgo)
  // cjepanoL = ogr.dugo + ogr.cijepano + gule   (we call it cijepano)
  cTrupci:  number
  dzgo:     number   // plan prostorna masa č (= cel.d+cel.c+šk)
  lTrupci:  number
  cijepano: number   // plan prostorna masa l (= ogr.d+ogr.c+gule)
  multiGJ?: boolean
}

// Actual broken down into 8 individual sortiments
interface ActualData {
  cTrupci:     number  // trupci_c
  celDuga:     number  // cel_duga
  celCijepana: number  // cel_cijepana
  skart:       number  // skart
  lTrupci:     number  // trupci_l
  ogrDugi:     number  // ogr_dugi
  ogrCijepani: number  // ogr_cijepani
  gule:        number  // gule
  ukupno:      number  // sheet total
}

// Derived aggregates that match plan groups
const dzgoAct  = (a: ActualData) => a.celDuga + a.celCijepana + a.skart
const cijAct   = (a: ActualData) => a.ogrDugi + a.ogrCijepani + a.gule

interface OdjelRow extends PlanEntry {
  actual:   ActualData
  stepen:   number
  koef:     number
  status:   StatusValue
  override: StatusOverride
}

// ── Plan data (BosanskaKrupa_Plan2025_FINAL_1.xlsx) ───────────────────────────
const PLAN_ENTRIES: PlanEntry[] = [
  // ── Risovac Krupa ──────────────────────────────────────────────────────────
  { gj:'Risovac Krupa', odjel:'13',   bruto:3244,  neto:2768, cTrupci:3,    dzgo:2,   lTrupci:875,  cijepano:1888 },
  { gj:'Risovac Krupa', odjel:'35',   bruto:5417,  neto:4648, cTrupci:122,  dzgo:44,  lTrupci:1813, cijepano:2670 },
  { gj:'Risovac Krupa', odjel:'50',   bruto:5161,  neto:4329, cTrupci:1824, dzgo:227, lTrupci:971,  cijepano:1307 },
  { gj:'Risovac Krupa', odjel:'54P',  bruto:1511,  neto:1276, cTrupci:639,  dzgo:109, lTrupci:208,  cijepano:320  },
  { gj:'Risovac Krupa', odjel:'55',   bruto:5195,  neto:4258, cTrupci:2193, dzgo:328, lTrupci:789,  cijepano:948  },
  { gj:'Risovac Krupa', odjel:'56',   bruto:3877,  neto:3206, cTrupci:1779, dzgo:263, lTrupci:439,  cijepano:725  },
  { gj:'Risovac Krupa', odjel:'59/1', bruto:3724,  neto:3087, cTrupci:1545, dzgo:208, lTrupci:658,  cijepano:676  },
  { gj:'Risovac Krupa', odjel:'63',   bruto:4033,  neto:3339, cTrupci:1309, dzgo:236, lTrupci:796,  cijepano:998  },
  { gj:'Risovac Krupa', odjel:'66',   bruto:2645,  neto:2307, cTrupci:0,    dzgo:52,  lTrupci:949,  cijepano:1307, multiGJ:true },
  { gj:'Risovac Krupa', odjel:'68/2', bruto:2605,  neto:2287, cTrupci:35,   dzgo:6,   lTrupci:1012, cijepano:1234 },
  { gj:'Risovac Krupa', odjel:'71P',  bruto:1957,  neto:1655, cTrupci:664,  dzgo:114, lTrupci:401,  cijepano:476  },
  { gj:'Risovac Krupa', odjel:'97',   bruto:4889,  neto:4058, cTrupci:1253, dzgo:236, lTrupci:901,  cijepano:1668 },
  { gj:'Risovac Krupa', odjel:'113P', bruto:5177,  neto:4300, cTrupci:225,  dzgo:74,  lTrupci:1278, cijepano:2723 },
  // ── Grmeč Jasenica ─────────────────────────────────────────────────────────
  { gj:'Grmeč Jasenica', odjel:'4/1',   bruto:2490, neto:2117, cTrupci:0,   dzgo:0,   lTrupci:303,  cijepano:1814 },
  { gj:'Grmeč Jasenica', odjel:'11P',   bruto:208,  neto:179,  cTrupci:0,   dzgo:0,   lTrupci:73,   cijepano:106  },
  { gj:'Grmeč Jasenica', odjel:'43P',   bruto:1099, neto:740,  cTrupci:40,  dzgo:100, lTrupci:160,  cijepano:440  },
  { gj:'Grmeč Jasenica', odjel:'60',    bruto:3551, neto:3061, cTrupci:295, dzgo:65,  lTrupci:1050, cijepano:1651 },
  { gj:'Grmeč Jasenica', odjel:'61',    bruto:4774, neto:4105, cTrupci:454, dzgo:102, lTrupci:1393, cijepano:2156 },
  { gj:'Grmeč Jasenica', odjel:'64/2P', bruto:996,  neto:608,  cTrupci:13,  dzgo:23,  lTrupci:211,  cijepano:361  },
  { gj:'Grmeč Jasenica', odjel:'66',    bruto:5339, neto:4493, cTrupci:0,   dzgo:0,   lTrupci:1025, cijepano:3468, multiGJ:true },
  { gj:'Grmeč Jasenica', odjel:'67',    bruto:4853, neto:4199, cTrupci:0,   dzgo:0,   lTrupci:1530, cijepano:2669 },
  { gj:'Grmeč Jasenica', odjel:'69P',   bruto:1309, neto:1204, cTrupci:82,  dzgo:32,  lTrupci:390,  cijepano:700  },
  { gj:'Grmeč Jasenica', odjel:'85P',   bruto:678,  neto:418,  cTrupci:0,   dzgo:73,  lTrupci:25,   cijepano:320  },
  { gj:'Grmeč Jasenica', odjel:'88P',   bruto:1805, neto:1200, cTrupci:0,   dzgo:0,   lTrupci:20,   cijepano:1180 },
  // ── Vojskova ────────────────────────────────────────────────────────────────
  { gj:'Vojskova', odjel:'15',  bruto:450, neto:383, cTrupci:0, dzgo:0, lTrupci:0,   cijepano:383 },
  { gj:'Vojskova', odjel:'21P', bruto:787, neto:624, cTrupci:0, dzgo:0, lTrupci:202, cijepano:422 },
  { gj:'Vojskova', odjel:'25',  bruto:750, neto:637, cTrupci:0, dzgo:0, lTrupci:0,   cijepano:637 },
]

// ── Constants ─────────────────────────────────────────────────────────────────
const GJ_LIST: GJ[] = ['Risovac Krupa', 'Grmeč Jasenica', 'Vojskova']
const GJ_COLOR: Record<GJ, string> = {
  'Risovac Krupa':  '#1d4ed8',
  'Grmeč Jasenica': '#15803d',
  'Vojskova':       '#b45309',
}

// Colors for plan groups and individual actual sortiments
const C = {
  cTrupci:     '#1e40af',
  celDuga:     '#5b21b6',
  celCijepana: '#7c3aed',
  skart:       '#9ca3af',
  lTrupci:     '#15803d',
  ogrDugi:     '#92400e',
  ogrCijepani: '#b45309',
  gule:        '#d97706',
  // Plan group aliases (for chart legend)
  planCjepanoC: '#7c3aed',
  planCjepanoL: '#b45309',
}

const STATUS_LABELS: Record<StatusOverride, string> = {
  auto:'Auto', posjeceno:'Posječeno', 'u-sjeci':'U sječi', planirano:'Planirano',
}
const STATUS_CSS: Record<StatusValue, string> = {
  posjeceno: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800',
  'u-sjeci': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  planirano: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Normalize: uppercase, remove diacritics, strip trailing "P" (prelazni marker)
// Primka stores "RISOVAC KRUPA 46", plan stores gj="Risovac Krupa" + odjel="46"
// so we match normKey(r.odjel) === normKey(entry.gj + " " + entry.odjel)
function normKey(s: string): string {
  return s.trim().toUpperCase()
    .replace(/Č/g, 'C').replace(/Ć/g, 'C')  // Č, Ć
    .replace(/Š/g, 'S')                            // Š
    .replace(/Ž/g, 'Z')                            // Ž
    .replace(/Đ/g, 'DJ')                           // Đ
    .replace(/P\s*$/, '').trim()                        // strip prelazni suffix
}
const lsKey = (gj: string, odjel: string) => `gp|${gj}|${odjel}`

function lsGet(gj: string, odjel: string): StatusOverride {
  try { return (localStorage.getItem(lsKey(gj, odjel)) as StatusOverride) || 'auto' } catch { return 'auto' }
}
function lsSet(gj: string, odjel: string, val: StatusOverride) {
  try {
    if (val === 'auto') localStorage.removeItem(lsKey(gj, odjel))
    else localStorage.setItem(lsKey(gj, odjel), val)
  } catch {}
}
function deriveStatus(pct: number): StatusValue {
  return pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano'
}
function koefCls(k: number) {
  return k >= 85 ? 'text-green-600 dark:text-green-400'
       : k >= 75 ? 'text-amber-600 dark:text-amber-400'
       : 'text-red-600 dark:text-red-400'
}

// ── Small components ──────────────────────────────────────────────────────────
function RealizacijaBadge({ pct }: { pct: number }) {
  const cls = pct >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            : pct >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
            : pct >  0  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            :              'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
  return <span className={cn('inline-block px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums', cls)}>{pct > 0 ? `${pct.toFixed(1)}%` : '—'}</span>
}

function Bar2({ pct, color='#15803d' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width:`${Math.min(Math.max(pct,0),100)}%`, backgroundColor:pct>100?'#dc2626':color }} />
    </div>
  )
}

function StatusBadge({ s }: { s: StatusValue }) {
  return <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', STATUS_CSS[s])}>{STATUS_LABELS[s]}</span>
}
function StatusSelect({ value, onChange }: { value: StatusOverride; onChange:(v:StatusOverride)=>void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as StatusOverride)}
      className="text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-forest-400 cursor-pointer">
      {(Object.keys(STATUS_LABELS) as StatusOverride[]).map(k => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
    </select>
  )
}

function SortimentCard({ label, plan, actual, color }: { label:string; plan:number; actual:number; color:string }) {
  const pct = plan > 0 ? actual/plan*100 : 0
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
        <RealizacijaBadge pct={pct} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tabular-nums" style={{ color }}>{formatNumber(actual,0)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">od {formatNumber(plan,0)} m³</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Ostalo</p>
          <p className="text-sm font-semibold tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(Math.max(0,plan-actual),0)} m³</p>
        </div>
      </div>
      <Bar2 pct={pct} color={color} />
    </div>
  )
}

function ThSort({ children, col, sort, asc, onSort, left }: {
  children: React.ReactNode; col:string; sort:string; asc:boolean; onSort:(c:string)=>void; left?:boolean
}) {
  return (
    <th onClick={()=>onSort(col)}
      className={cn('px-3 py-2.5 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 whitespace-nowrap',
        left ? 'text-left' : 'text-right')}>
      <span className={cn('flex items-center gap-1', left ? 'justify-start' : 'justify-end')}>
        {children}
        {sort===col ? (asc?'↑':'↓') : <span className="opacity-30">↕</span>}
      </span>
    </th>
  )
}

function GJHeader({ gj, colSpan }: { gj: GJ; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider border-y border-gray-200 dark:border-gray-700"
        style={{ backgroundColor: GJ_COLOR[gj]+'18', color: GJ_COLOR[gj] }}>
        {gj}
      </td>
    </tr>
  )
}

// ── Tab 1: Po grupama ─────────────────────────────────────────────────────────
// Shows 8 individual actual sortiments vs 4 plan aggregates
function PoGrupama({ rows, onStatus }: { rows: OdjelRow[]; onStatus:(gj:GJ,o:string,v:StatusOverride)=>void }) {
  const [sort, setSort] = useState('plan')
  const [asc,  setAsc]  = useState(false)

  function hs(col: string) { if (sort===col) setAsc(p=>!p); else { setSort(col); setAsc(false) } }

  const grouped = useMemo(() => {
    const s = [...rows].sort((a,b) => {
      if (sort==='odjel') return asc ? a.odjel.localeCompare(b.odjel) : b.odjel.localeCompare(a.odjel)
      const map: Record<string,(r:OdjelRow)=>number> = {
        plan:o=>o.neto, ostvareno:o=>o.actual.ukupno, stepen:o=>o.stepen, koef:o=>o.koef,
      }
      const fn = map[sort]??(()=>0)
      return asc ? fn(a)-fn(b) : fn(b)-fn(a)
    })
    return GJ_LIST.map(gj => s.filter(r=>r.gj===gj))
  }, [rows,sort,asc])

  // Chart: plan (4 bars stacked) vs actual (8 bars stacked), top 15 by plan neto
  const chartData = useMemo(() =>
    [...rows].sort((a,b)=>a.neto-b.neto).slice(-15).map(d => ({
      name: d.odjel,
      // Plan (dark)
      'P: Trupci Č':  d.cTrupci,
      'P: Cjepano Č': d.dzgo,
      'P: Trupci L':  d.lTrupci,
      'P: Cjepano L': d.cijepano,
      // Actual (lighter)
      'A: Trupci Č':   d.actual.cTrupci,
      'A: Cel. duga':  d.actual.celDuga,
      'A: Cel. cij.':  d.actual.celCijepana,
      'A: Škart':      d.actual.skart,
      'A: Trupci L':   d.actual.lTrupci,
      'A: Ogr. dugo':  d.actual.ogrDugi,
      'A: Ogr. cij.':  d.actual.ogrCijepani,
      'A: Gule':       d.actual.gule,
    }))
  , [rows])

  // Helper: format cell, show — for zero
  const f0 = (v: number) => v > 0
    ? <span className="font-medium tabular-nums">{formatNumber(v,0)}</span>
    : <span className="text-gray-300 dark:text-gray-700">—</span>

  // Total cols: #(1) + odjel(1) + status(1) + koef(1) + trupciC(2) + cjepaC(4) + trupciL(2) + cjepaL(4) + plan+ostvr+stepen(3) = 19
  const NCOLS = 19

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Plan vs. ostvareno po sortimentima — top 15 odjela</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Tamno = plan (4 grupe) · Svjetlo = ostvareno (8 sortimenata)
          </p>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length*32)}>
            <BarChart data={chartData} layout="vertical" margin={{ top:4, right:20, left:10, bottom:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize:10, fill:'#6b7280' }} tickLine={false} axisLine={false}
                tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize:11, fill:'#374151' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v:number,n:string)=>[`${formatNumber(v,0)} m³`,n]} cursor={{ fill:'rgba(0,0,0,0.04)' }} />
              <Legend wrapperStyle={{ fontSize:'10px', paddingTop:'8px' }} formatter={(v:string)=><span style={{ color:'#6b7280' }}>{v}</span>} />
              {/* Plan bars (full opacity) */}
              <Bar dataKey="P: Trupci Č"  stackId="p" fill={C.cTrupci}      fillOpacity={0.9} maxBarSize={11} />
              <Bar dataKey="P: Cjepano Č" stackId="p" fill={C.celCijepana}  fillOpacity={0.9} maxBarSize={11} />
              <Bar dataKey="P: Trupci L"  stackId="p" fill={C.lTrupci}      fillOpacity={0.9} maxBarSize={11} />
              <Bar dataKey="P: Cjepano L" stackId="p" fill={C.ogrCijepani}  fillOpacity={0.9} maxBarSize={11} />
              {/* Actual bars (lower opacity, 8 individual) */}
              <Bar dataKey="A: Trupci Č"   stackId="a" fill={C.cTrupci}      fillOpacity={0.45} maxBarSize={11} />
              <Bar dataKey="A: Cel. duga"  stackId="a" fill={C.celDuga}      fillOpacity={0.45} maxBarSize={11} />
              <Bar dataKey="A: Cel. cij."  stackId="a" fill={C.celCijepana}  fillOpacity={0.45} maxBarSize={11} />
              <Bar dataKey="A: Škart"      stackId="a" fill={C.skart}        fillOpacity={0.45} maxBarSize={11} />
              <Bar dataKey="A: Trupci L"   stackId="a" fill={C.lTrupci}      fillOpacity={0.45} maxBarSize={11} />
              <Bar dataKey="A: Ogr. dugo"  stackId="a" fill={C.ogrDugi}      fillOpacity={0.45} maxBarSize={11} />
              <Bar dataKey="A: Ogr. cij."  stackId="a" fill={C.ogrCijepani}  fillOpacity={0.45} maxBarSize={11} />
              <Bar dataKey="A: Gule"       stackId="a" fill={C.gule}         fillOpacity={0.45} maxBarSize={11} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Detalji po odjelima — 8 sortimenata</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Plan (agregat) vs. Ostvareno (pojedinačni sortimenti) · Koef. = neto/bruto
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Row 1: group headers */}
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700/50">
                <th rowSpan={2} className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-7 border-b border-gray-200 dark:border-gray-700">#</th>
                <th rowSpan={2} className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Odjel</th>
                <th rowSpan={2} className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Status</th>
                <th rowSpan={2} className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Koef.</th>

                {/* Trupci Č — 2 cols */}
                <th colSpan={2} className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-l border-gray-200 dark:border-gray-700"
                  style={{ color:C.cTrupci }}>Trupci Č</th>

                {/* Cjepano Č — plan(1) + cel.d+cel.c+šk(3) = 4 cols */}
                <th colSpan={4} className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-l border-gray-200 dark:border-gray-700"
                  style={{ color:C.celCijepana }}>Cjepano Č</th>

                {/* Trupci L — 2 cols */}
                <th colSpan={2} className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-l border-gray-200 dark:border-gray-700"
                  style={{ color:C.lTrupci }}>Trupci L</th>

                {/* Cjepano L — plan(1) + ogr.d+ogr.c+gule(3) = 4 cols */}
                <th colSpan={4} className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-l border-gray-200 dark:border-gray-700"
                  style={{ color:C.ogrCijepani }}>Cjepano L</th>

                <th rowSpan={2} className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap border-l border-gray-200 dark:border-gray-700 border-b border-gray-200 dark:border-gray-700">Plan m³</th>
                <th rowSpan={2} className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap border-b border-gray-200 dark:border-gray-700">Ostvr. m³</th>
                <th rowSpan={2} className="px-3 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Stepen</th>
              </tr>
              {/* Row 2: sub-labels */}
              <tr className="bg-gray-50/60 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                {/* Trupci Č */}
                <td className="px-2 py-1.5 text-right border-l border-gray-200 dark:border-gray-700 whitespace-nowrap">Plan</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.cTrupci }}>Ostvr.</td>
                {/* Cjepano Č */}
                <td className="px-2 py-1.5 text-right border-l border-gray-200 dark:border-gray-700 whitespace-nowrap">Plan</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.celDuga }}>Cel.d.</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.celCijepana }}>Cel.c.</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.skart }}>Škart</td>
                {/* Trupci L */}
                <td className="px-2 py-1.5 text-right border-l border-gray-200 dark:border-gray-700 whitespace-nowrap">Plan</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.lTrupci }}>Ostvr.</td>
                {/* Cjepano L */}
                <td className="px-2 py-1.5 text-right border-l border-gray-200 dark:border-gray-700 whitespace-nowrap">Plan</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.ogrDugi }}>Ogr.d.</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.ogrCijepani }}>Ogr.c.</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium" style={{ color:C.gule }}>Gule</td>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {GJ_LIST.map(gj => {
                const gjRows = grouped[GJ_LIST.indexOf(gj)]
                if (!gjRows?.length) return null
                return (
                  <>
                    <GJHeader key={`h-${gj}`} gj={gj} colSpan={NCOLS} />
                    {gjRows.map((row, i) => (
                      <tr key={`${gj}-${row.odjel}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-3 py-2 text-gray-400 text-xs tabular-nums">{i+1}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {row.odjel}{row.multiGJ && <sup className="text-gray-400 text-xs ml-0.5">*</sup>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusBadge s={row.status} />
                            <StatusSelect value={row.override} onChange={v=>onStatus(gj,row.odjel,v)} />
                          </div>
                        </td>
                        <td className={cn('px-3 py-2 text-right text-xs font-semibold tabular-nums whitespace-nowrap', koefCls(row.koef))}>{row.koef.toFixed(1)}%</td>
                        {/* ── Trupci Č ── */}
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap border-l border-gray-100 dark:border-gray-800">{formatNumber(row.cTrupci,0)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.cTrupci }}>{f0(row.actual.cTrupci)}</td>
                        {/* ── Cjepano Č ── */}
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap border-l border-gray-100 dark:border-gray-800">{formatNumber(row.dzgo,0)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.celDuga }}>{f0(row.actual.celDuga)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.celCijepana }}>{f0(row.actual.celCijepana)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.skart }}>{f0(row.actual.skart)}</td>
                        {/* ── Trupci L ── */}
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap border-l border-gray-100 dark:border-gray-800">{formatNumber(row.lTrupci,0)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.lTrupci }}>{f0(row.actual.lTrupci)}</td>
                        {/* ── Cjepano L ── */}
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap border-l border-gray-100 dark:border-gray-800">{formatNumber(row.cijepano,0)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.ogrDugi }}>{f0(row.actual.ogrDugi)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.ogrCijepani }}>{f0(row.actual.ogrCijepani)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap" style={{ color:C.gule }}>{f0(row.actual.gule)}</td>
                        {/* ── Totals ── */}
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap border-l border-gray-100 dark:border-gray-800">{formatNumber(row.neto,0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatNumber(row.actual.ukupno,0)}</td>
                        <td className="px-3 py-2 text-right"><RealizacijaBadge pct={row.stepen} /></td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Cjepano Č plan = Cel.duga + Cel.cijepana + Škart · Cjepano L plan = Ogr.dugo + Ogr.cijepano + Gule · * Odjel 66 nastupa u dvije GJ (Risovac Krupa + Grmeč Jasenica)
        </p>
      </div>
    </div>
  )
}

// ── Tab 2: Po sortimentima ────────────────────────────────────────────────────
function PoSortimentima({ rows, onStatus, totals }: {
  rows: OdjelRow[]
  onStatus: (gj:GJ,o:string,v:StatusOverride)=>void
  totals: { planCT:number; planDz:number; planLT:number; planCij:number; planNeto:number; actCT:number; actDz:number; actLT:number; actCij:number; actUk:number }
}) {
  const [sort, setSort] = useState('stepen')
  const [asc,  setAsc]  = useState(false)
  function hs(col:string) { if(sort===col)setAsc(p=>!p);else{setSort(col);setAsc(false)} }

  const sorted = useMemo(()=>[...rows].sort((a,b)=>{
    if(sort==='odjel')return asc?a.odjel.localeCompare(b.odjel):b.odjel.localeCompare(a.odjel)
    const map:Record<string,(r:OdjelRow)=>number>={
      plan:o=>o.neto,ostvareno:o=>o.actual.ukupno,stepen:o=>o.stepen,koef:o=>o.koef,
    }
    const fn=map[sort]??(()=>0)
    return asc?fn(a)-fn(b):fn(b)-fn(a)
  }),[rows,sort,asc])

  const chartData = useMemo(()=>
    [...rows].filter(d=>d.neto>0).map(d=>({
      name:d.odjel,
      'Trupci Č': d.cTrupci >0 ? +(d.actual.cTrupci/d.cTrupci*100).toFixed(1):0,
      'Cjepano Č':d.dzgo    >0 ? +(dzgoAct(d.actual)/d.dzgo    *100).toFixed(1):0,
      'Trupci L': d.lTrupci >0 ? +(d.actual.lTrupci/d.lTrupci *100).toFixed(1):0,
      'Cjepano L':d.cijepano>0 ? +(cijAct(d.actual) /d.cijepano*100).toFixed(1):0,
      ukupno:     d.neto    >0 ? +(d.actual.ukupno  /d.neto    *100).toFixed(1):0,
    }))
    .sort((a,b)=>a.ukupno-b.ukupno).slice(-20)
  ,[rows])

  const stepUk = totals.planNeto>0 ? totals.actUk/totals.planNeto*100 : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SortimentCard label="Trupci Č"  plan={totals.planCT}  actual={totals.actCT}  color={C.cTrupci} />
        <SortimentCard label="Cjepano Č" plan={totals.planDz}  actual={totals.actDz}  color={C.celCijepana} />
        <SortimentCard label="Trupci L"  plan={totals.planLT}  actual={totals.actLT}  color={C.lTrupci} />
        <SortimentCard label="Cjepano L" plan={totals.planCij} actual={totals.actCij} color={C.ogrCijepani} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ukupna realizacija godišnjeg plana 2026</h3>
            <p className="text-xs text-gray-400 mt-0.5">Plan: {formatNumber(totals.planNeto,0)} m³ neto · Ostvareno: {formatNumber(totals.actUk,0)} m³</p>
          </div>
          <RealizacijaBadge pct={stepUk} />
        </div>
        <Bar2 pct={stepUk} color="#15803d" />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {([['Trupci Č',totals.planCT,totals.actCT,C.cTrupci],
             ['Cjepano Č',totals.planDz,totals.actDz,C.celCijepana],
             ['Trupci L',totals.planLT,totals.actLT,C.lTrupci],
             ['Cjepano L',totals.planCij,totals.actCij,C.ogrCijepani],
          ] as [string,number,number,string][]).map(([label,plan,act,col])=>(
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium" style={{ color:col }}>{label}</span>
                <span className="text-gray-400">{plan>0?`${(act/plan*100).toFixed(1)}%`:'—'}</span>
              </div>
              <Bar2 pct={plan>0?act/plan*100:0} color={col} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Stepen realizacije po odjelima — top 20</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">% ostvarenja planiranih masa · crvena linija = 100%</p>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={Math.max(300,chartData.length*34)}>
            <BarChart data={chartData} layout="vertical" margin={{ top:4,right:50,left:10,bottom:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" domain={[0,'auto']} tick={{ fontSize:10,fill:'#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize:11,fill:'#374151' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v:number)=>[`${v.toFixed(1)}%`]} cursor={{ fill:'rgba(0,0,0,0.04)' }} />
              <ReferenceLine x={100} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1.5} />
              <Legend wrapperStyle={{ fontSize:'11px',paddingTop:'8px' }} formatter={(v:string)=><span style={{ color:'#6b7280' }}>{v}</span>} />
              <Bar dataKey="Trupci Č"  fill={C.cTrupci}     maxBarSize={9} />
              <Bar dataKey="Cjepano Č" fill={C.celCijepana} maxBarSize={9} />
              <Bar dataKey="Trupci L"  fill={C.lTrupci}     maxBarSize={9} />
              <Bar dataKey="Cjepano L" fill={C.ogrCijepani} maxBarSize={9} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Projektovana masa i stepen realizacije po sortimentima</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-7">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">GJ</th>
                <ThSort col="odjel" sort={sort} asc={asc} onSort={hs} left>Odjel</ThSort>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <ThSort col="koef"      sort={sort} asc={asc} onSort={hs}>Koef.</ThSort>
                <ThSort col="plan"      sort={sort} asc={asc} onSort={hs}>Plan m³</ThSort>
                <ThSort col="ostvareno" sort={sort} asc={asc} onSort={hs}>Ostvr. m³</ThSort>
                <ThSort col="stepen"    sort={sort} asc={asc} onSort={hs}>Stepen</ThSort>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color:C.cTrupci }}>Trupci Č %</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color:C.celCijepana }}>Cjepano Č %</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color:C.lTrupci }}>Trupci L %</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color:C.ogrCijepani }}>Cjepano L %</th>
                <th className="px-3 py-2.5 w-24 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((row,idx)=>{
                const sp=(a:number,p:number)=>p>0?a/p*100:null
                const stepCT  = sp(row.actual.cTrupci,    row.cTrupci)
                const stepDz  = sp(dzgoAct(row.actual),   row.dzgo)
                const stepLT  = sp(row.actual.lTrupci,    row.lTrupci)
                const stepCij = sp(cijAct(row.actual),    row.cijepano)
                return (
                  <tr key={`${row.gj}-${row.odjel}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-3 py-2 text-gray-400 text-xs tabular-nums">{idx+1}</td>
                    <td className="px-3 py-2 text-xs font-medium whitespace-nowrap" style={{ color:GJ_COLOR[row.gj] }}>{row.gj}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {row.odjel}{row.multiGJ&&<sup className="text-gray-400 text-xs ml-0.5">*</sup>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge s={row.status} />
                        <StatusSelect value={row.override} onChange={v=>onStatus(row.gj,row.odjel,v)} />
                      </div>
                    </td>
                    <td className={cn('px-3 py-2 text-right text-xs font-semibold tabular-nums whitespace-nowrap',koefCls(row.koef))}>{row.koef.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatNumber(row.neto,0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{formatNumber(row.actual.ukupno,0)}</td>
                    <td className="px-3 py-2 text-right"><RealizacijaBadge pct={row.stepen} /></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{stepCT !==null&&row.cTrupci >0?<RealizacijaBadge pct={stepCT} />:<span className="text-gray-300 dark:text-gray-700">—</span>}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{stepDz !==null&&row.dzgo    >0?<RealizacijaBadge pct={stepDz} />:<span className="text-gray-300 dark:text-gray-700">—</span>}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{stepLT !==null&&row.lTrupci >0?<RealizacijaBadge pct={stepLT} />:<span className="text-gray-300 dark:text-gray-700">—</span>}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{stepCij!==null&&row.cijepano>0?<RealizacijaBadge pct={stepCij} />:<span className="text-gray-300 dark:text-gray-700">—</span>}</td>
                    <td className="px-3 py-3"><Bar2 pct={row.stepen} color="#15803d" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
          * Odjel 66 nastupa u dvije GJ (Risovac Krupa + Grmeč Jasenica)
        </p>
      </div>
    </div>
  )
}

// ── Tab 3: Pregled plana ──────────────────────────────────────────────────────
function PregledPlana({ rows, onStatus }: { rows: OdjelRow[]; onStatus:(gj:GJ,o:string,v:StatusOverride)=>void }) {
  const grouped = useMemo(() =>
    GJ_LIST.map(gj => ({ gj, rows: rows.filter(r => r.gj === gj) })).filter(g => g.rows.length > 0)
  , [rows])

  const grand = useMemo(() => ({
    bruto:    rows.reduce((s,r)=>s+r.bruto,0),
    neto:     rows.reduce((s,r)=>s+r.neto,0),
    cTrupci:  rows.reduce((s,r)=>s+r.cTrupci,0),
    dzgo:     rows.reduce((s,r)=>s+r.dzgo,0),
    lTrupci:  rows.reduce((s,r)=>s+r.lTrupci,0),
    cijepano: rows.reduce((s,r)=>s+r.cijepano,0),
  }), [rows])

  const rowBg: Record<StatusValue, string> = {
    posjeceno: 'bg-green-50  dark:bg-green-950/40',
    'u-sjeci': 'bg-amber-50  dark:bg-amber-950/40',
    planirano: '',
  }

  const f = (v: number) => v > 0
    ? <span className="tabular-nums">{formatNumber(v,0)}</span>
    : <span className="text-gray-300 dark:text-gray-700">—</span>

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-200 dark:bg-green-800" />
          Posječeno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-800" />
          U sječi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
          Planirano
        </span>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Plan sječe 2026 — Pogon Bosanska Krupa</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sve mase u m³ · P = prelazni odjel</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-medium uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left  text-gray-400 w-8">Rb.</th>
                <th className="px-3 py-2.5 text-left  text-gray-400">Odjel</th>
                <th className="px-3 py-2.5 text-right text-gray-400 whitespace-nowrap">Bruto m³</th>
                <th className="px-3 py-2.5 text-right text-gray-400 whitespace-nowrap">Neto m³</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color:C.cTrupci }}>Trupci Č</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color:C.celCijepana }}>Cjepano Č</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color:C.lTrupci }}>Trupci L</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color:C.ogrCijepani }}>Cjepano L</th>
                <th className="px-3 py-2.5 text-left  text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ gj, rows: gjRows }) => {
                const sub = {
                  bruto:    gjRows.reduce((s,r)=>s+r.bruto,0),
                  neto:     gjRows.reduce((s,r)=>s+r.neto,0),
                  cTrupci:  gjRows.reduce((s,r)=>s+r.cTrupci,0),
                  dzgo:     gjRows.reduce((s,r)=>s+r.dzgo,0),
                  lTrupci:  gjRows.reduce((s,r)=>s+r.lTrupci,0),
                  cijepano: gjRows.reduce((s,r)=>s+r.cijepano,0),
                }
                return (
                  <>
                    <tr key={`h-${gj}`}>
                      <td colSpan={9} className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-y border-gray-200 dark:border-gray-700"
                        style={{ backgroundColor:GJ_COLOR[gj]+'22', color:GJ_COLOR[gj] }}>
                        {gj}
                      </td>
                    </tr>

                    {gjRows.map((row, i) => (
                      <tr key={`${gj}-${row.odjel}`}
                        className={cn('border-b border-gray-100 dark:border-gray-800 transition-colors', rowBg[row.status])}>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {row.odjel}{row.multiGJ && <sup className="text-gray-400 text-xs ml-0.5">*</sup>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500 dark:text-gray-400">{f(row.bruto)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800 dark:text-gray-100">{f(row.neto)}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color:row.cTrupci>0?C.cTrupci:undefined }}>{f(row.cTrupci)}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color:row.dzgo>0?C.celCijepana:undefined }}>{f(row.dzgo)}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color:row.lTrupci>0?C.lTrupci:undefined }}>{f(row.lTrupci)}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color:row.cijepano>0?C.ogrCijepani:undefined }}>{f(row.cijepano)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusBadge s={row.status} />
                            <StatusSelect value={row.override} onChange={v=>onStatus(gj,row.odjel,v)} />
                          </div>
                        </td>
                      </tr>
                    ))}

                    <tr key={`sub-${gj}`} className="border-b-2 border-gray-200 dark:border-gray-600 font-semibold text-xs"
                      style={{ backgroundColor:GJ_COLOR[gj]+'12' }}>
                      <td colSpan={2} className="px-4 py-2 uppercase tracking-wider" style={{ color:GJ_COLOR[gj] }}>
                        Ukupno {gj}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatNumber(sub.bruto,0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-800 dark:text-gray-100 whitespace-nowrap">{formatNumber(sub.neto,0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color:C.cTrupci }}>{formatNumber(sub.cTrupci,0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color:C.celCijepana }}>{formatNumber(sub.dzgo,0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color:C.lTrupci }}>{formatNumber(sub.lTrupci,0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color:C.ogrCijepani }}>{formatNumber(sub.cijepano,0)}</td>
                      <td />
                    </tr>
                  </>
                )
              })}

              {/* Grand total */}
              <tr className="bg-gray-800 dark:bg-gray-700 text-white text-xs font-bold uppercase tracking-wider">
                <td colSpan={2} className="px-4 py-3">Sveukupno</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatNumber(grand.bruto,0)}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatNumber(grand.neto,0)}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatNumber(grand.cTrupci,0)}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatNumber(grand.dzgo,0)}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatNumber(grand.lTrupci,0)}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatNumber(grand.cijepano,0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Cjepano Č = Cel.duga + Cel.cijepana + Škart · Cjepano L = Ogr.dugo + Ogr.cijepano + Gule · * Odjel 66 nastupa u dvije GJ
        </p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type GJFilter     = 'sve' | GJ
type StatusFilter = 'sve' | StatusValue

export default function GodišnjiPlan() {
  const { primkaRows, loading, error, refetch } = useSheet()
  const [activeTab,    setActiveTab]    = useState<TabKey>('grupe')
  const [gjFilter,     setGjFilter]     = useState<GJFilter>('sve')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('sve')
  const [showDiag,     setShowDiag]     = useState(false)

  const [overrides, setOverrides] = useState<Map<string,StatusOverride>>(() => {
    const m = new Map<string,StatusOverride>()
    for (const e of PLAN_ENTRIES) {
      const v = lsGet(e.gj, e.odjel)
      if (v !== 'auto') m.set(`${e.gj}|${e.odjel}`, v)
    }
    return m
  })

  const handleStatus = useCallback((gj:GJ, odjel:string, val:StatusOverride) => {
    lsSet(gj, odjel, val)
    setOverrides(prev => {
      const next = new Map(prev)
      const key = `${gj}|${odjel}`
      if (val==='auto') next.delete(key); else next.set(key, val)
      return next
    })
  }, [])

  // Aggregate actual by normalized odjel — only 2026 data
  // primka stores full "RISOVAC KRUPA 46"; key strips accents + trailing P
  const actualByOdjel = useMemo(() => {
    const m = new Map<string, ActualData>()
    for (const r of primkaRows) {
      if (r.datum.getFullYear() !== 2026) continue
      const key = normKey(r.odjel)
      const d: ActualData = {
        cTrupci:     r.trupci_c,
        celDuga:     r.cel_duga,
        celCijepana: r.cel_cijepana,
        skart:       r.skart,
        lTrupci:     r.trupci_l,
        ogrDugi:     r.ogr_dugi,
        ogrCijepani: r.ogr_cijepani,
        gule:        r.gule,
        ukupno:      r.ukupno,
      }
      const e = m.get(key)
      if (e) {
        e.cTrupci+=d.cTrupci; e.celDuga+=d.celDuga; e.celCijepana+=d.celCijepana; e.skart+=d.skart
        e.lTrupci+=d.lTrupci; e.ogrDugi+=d.ogrDugi; e.ogrCijepani+=d.ogrCijepani; e.gule+=d.gule
        e.ukupno+=d.ukupno
      } else {
        m.set(key, { ...d })
      }
    }
    return m
  }, [primkaRows])

  // Unique odjel values from primka (for diagnostics)
  const primkaOdjeli = useMemo(() =>
    Array.from(new Set(primkaRows.map(r => r.odjel).filter(Boolean))).sort()
  , [primkaRows])

  const zero: ActualData = { cTrupci:0, celDuga:0, celCijepana:0, skart:0, lTrupci:0, ogrDugi:0, ogrCijepani:0, gule:0, ukupno:0 }

  const allRows = useMemo<OdjelRow[]>(() => {
    return PLAN_ENTRIES.map(entry => {
      // Key matches primka format "GJ_NORM ODJEL_NORM" e.g. "RISOVAC KRUPA 46"
      const actual = actualByOdjel.get(normKey(entry.gj + ' ' + entry.odjel)) ?? { ...zero }
      const stepen   = entry.neto > 0 ? actual.ukupno / entry.neto * 100 : 0
      const koef     = entry.bruto > 0 ? entry.neto / entry.bruto * 100 : 0
      const override = overrides.get(`${entry.gj}|${entry.odjel}`) ?? 'auto'
      const status   = override === 'auto' ? deriveStatus(stepen) : override as StatusValue
      return { ...entry, actual, stepen, koef, status, override }
    })
  }, [actualByOdjel, overrides])

  const filteredRows = useMemo(() =>
    allRows.filter(r =>
      (gjFilter==='sve' || r.gj===gjFilter) &&
      (statusFilter==='sve' || r.status===statusFilter)
    )
  , [allRows, gjFilter, statusFilter])

  const totals = useMemo(() => ({
    planCT:   filteredRows.reduce((s,r)=>s+r.cTrupci,0),
    planDz:   filteredRows.reduce((s,r)=>s+r.dzgo,0),
    planLT:   filteredRows.reduce((s,r)=>s+r.lTrupci,0),
    planCij:  filteredRows.reduce((s,r)=>s+r.cijepano,0),
    planNeto: filteredRows.reduce((s,r)=>s+r.neto,0),
    actCT:    filteredRows.reduce((s,r)=>s+r.actual.cTrupci,0),
    actDz:    filteredRows.reduce((s,r)=>s+dzgoAct(r.actual),0),
    actLT:    filteredRows.reduce((s,r)=>s+r.actual.lTrupci,0),
    actCij:   filteredRows.reduce((s,r)=>s+cijAct(r.actual),0),
    actUk:    filteredRows.reduce((s,r)=>s+r.actual.ukupno,0),
  }), [filteredRows])

  const statusCounts = useMemo(() => {
    const c = { sve:allRows.length, posjeceno:0, 'u-sjeci':0, planirano:0 } as Record<string,number>
    for (const r of allRows) c[r.status]++
    return c
  }, [allRows])

  if (error) return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
      <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Greška pri učitavanju podataka</h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
      <button onClick={refetch} className="text-sm font-medium text-red-700 underline">Pokušaj ponovo</button>
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Godišnji plan 2026</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Revidirani plan — Pogon Bosanska Krupa · {PLAN_ENTRIES.length} odjela ·{' '}
          {formatNumber(PLAN_ENTRIES.reduce((s,e)=>s+e.neto,0),0)} m³ neto plana
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">GJ:</span>
          {(['sve',...GJ_LIST] as const).map(gj=>(
            <button key={gj} onClick={()=>setGjFilter(gj)}
              className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                gjFilter===gj
                  ? gj==='sve' ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-100 dark:text-gray-900'
                               : 'text-white border-transparent'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400'
              )}
              style={gjFilter===gj&&gj!=='sve'?{backgroundColor:GJ_COLOR[gj],borderColor:GJ_COLOR[gj]}:undefined}>
              {gj==='sve'?'Sve GJ':gj}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status:</span>
          {([
            {id:'sve',       label:`Sve (${statusCounts.sve})`},
            {id:'posjeceno', label:`Posječeno (${statusCounts.posjeceno})`},
            {id:'u-sjeci',   label:`U sječi (${statusCounts['u-sjeci']})`},
            {id:'planirano', label:`Planirano (${statusCounts.planirano})`},
          ] as const).map(({id,label})=>(
            <button key={id} onClick={()=>setStatusFilter(id)}
              className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                statusFilter===id
                  ? id==='posjeceno' ? 'bg-green-600 text-white border-green-600'
                  : id==='u-sjeci'   ? 'bg-amber-500 text-white border-amber-500'
                  : id==='planirano' ? 'bg-gray-500 text-white border-gray-500'
                  :                    'bg-gray-800 text-white border-gray-800 dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400'
              )}>
              {label}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-gray-400 animate-pulse self-center">Učitavanje...</span>}
      </div>

      {/* Diagnostics */}
      <div className="text-xs">
        <button onClick={()=>setShowDiag(p=>!p)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline decoration-dotted">
          {showDiag?'▲':'▼'} Dijagnostika ({primkaRows.filter(r=>r.datum.getFullYear()===2026).length} primka redova 2026, {primkaOdjeli.length} unikat. odjela ukupno)
        </button>
        {showDiag && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
            <p className="font-medium text-gray-600 dark:text-gray-300">Odjeli u primki (tačan naziv iz sheeta):</p>
            <p className="text-gray-500 dark:text-gray-400 font-mono break-all">{primkaOdjeli.map(normKey).join(' · ')||'— nema podataka —'}</p>
            <p className="font-medium text-gray-600 dark:text-gray-300 mt-1">Ključevi plana (GJ + odjel, normalizirani):</p>
            <p className="text-gray-500 dark:text-gray-400 font-mono break-all">
              {PLAN_ENTRIES.map(e=>normKey(e.gj+' '+e.odjel)).sort().join(' · ')}
            </p>
            <p className="font-medium text-gray-600 dark:text-gray-300 mt-1">Pronađeni match-ovi:</p>
            <p className="text-gray-500 dark:text-gray-400 font-mono break-all">
              {PLAN_ENTRIES.map(e=>normKey(e.gj+' '+e.odjel))
                .filter(k=>actualByOdjel.has(k)).sort().join(' · ')||'— nema match-ova —'}
            </p>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {([
          {id:'grupe',      label:'Po grupama'},
          {id:'sortimenti', label:'Po sortimentima'},
          {id:'pregled',    label:'Pregled plana'},
        ] as const).map(({id,label})=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab===id
                ? 'border-forest-600 text-forest-700 dark:text-forest-400 dark:border-forest-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            )}>
            {label}
          </button>
        ))}
      </div>

      {filteredRows.length===0
        ? <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">Nema odjela za odabrane filtere.</div>
        : activeTab==='grupe'
          ? <PoGrupama rows={filteredRows} onStatus={handleStatus} />
          : activeTab==='sortimenti'
          ? <PoSortimentima rows={filteredRows} onStatus={handleStatus} totals={totals} />
          : <PregledPlana rows={allRows.filter(r => gjFilter==='sve' || r.gj===gjFilter)} onStatus={handleStatus} />
      }
    </div>
  )
}
