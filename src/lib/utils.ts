import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, startOfYear, subDays, getISOWeek, getISOWeekYear, getMonth, getQuarter, getYear } from "date-fns";
import type { DateRange, QuickSelect, PrimkaRow, OtpremaRow, PrimacSummary, OdjelSummary, DailyTotal, GradeData, RadilisteSummary, IzvođačSummary, OtpremacSummary, KupacSummary, PeriodTotal, PeriodSortimenti } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("bs-BA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date): string {
  return format(date, "dd.MM.yyyy");
}

export function getQuickSelectRange(qs: QuickSelect): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = subDays(today, 1);

  switch (qs) {
    case "7d":
      return { from: subDays(yesterday, 6), to: yesterday };
    case "30d":
      return { from: subDays(yesterday, 29), to: yesterday };
    case "90d":
      return { from: subDays(yesterday, 89), to: yesterday };
    case "ytd":
      return { from: startOfYear(today), to: yesterday };
    case "all":
      return { from: new Date(2023, 0, 1), to: yesterday };
  }
}

export function getLastNDaysRange(n: number): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = subDays(today, 1);
  return { from: subDays(yesterday, n - 1), to: yesterday };
}

export function dateRangeToParams(range: DateRange): string {
  return `from=${format(range.from, "yyyy-MM-dd")}&to=${format(range.to, "yyyy-MM-dd")}`;
}

export function filterByDateRange<T extends { datum: Date }>(
  rows: T[],
  range: DateRange
): T[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows.filter((row) => {
    const d = row.datum;
    if (d < range.from || d > range.to) return false;
    if (d >= todayStart) return false; // Uvijek izuzmi današnji dan
    const day = d.getDay();
    // Exclude Sunday always; Saturday only appears if it has data (working Saturday)
    return day !== 0;
  });
}

export function aggregatePrimacSummary(rows: PrimkaRow[]): PrimacSummary[] {
  const map = new Map<string, PrimacSummary>();

  for (const row of rows) {
    const existing = map.get(row.primac);
    if (existing) {
      existing.totalUkupno += row.ukupno;
      existing.totalCetinari += row.sigma_cetinari;
      existing.totalLiscare += row.liscare;
      existing.count += 1;
    } else {
      map.set(row.primac, {
        primac: row.primac,
        totalUkupno: row.ukupno,
        totalCetinari: row.sigma_cetinari,
        totalLiscare: row.liscare,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalUkupno - a.totalUkupno);
}

export function aggregateOdjelSummary(rows: PrimkaRow[]): OdjelSummary[] {
  const map = new Map<string, number>();

  for (const row of rows) {
    const existing = map.get(row.odjel) ?? 0;
    map.set(row.odjel, existing + row.ukupno);
  }

  return Array.from(map.entries())
    .map(([odjel, totalUkupno]) => ({ odjel, totalUkupno }))
    .sort((a, b) => b.totalUkupno - a.totalUkupno);
}

export function aggregateDailyTotals(rows: PrimkaRow[]): DailyTotal[] {
  const map = new Map<string, DailyTotal>();

  for (const row of rows) {
    const key = format(row.datum, "yyyy-MM-dd");
    const existing = map.get(key);
    if (existing) {
      existing.ukupno += row.ukupno;
      existing.cetinari += row.sigma_cetinari;
      existing.liscare += row.liscare;
    } else {
      map.set(key, {
        datum: key,
        ukupno: row.ukupno,
        cetinari: row.sigma_cetinari,
        liscare: row.liscare,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.datum.localeCompare(b.datum)
  );
}

export function parseBosnianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;
  // Support DD.MM.YYYY and DD/MM/YYYY
  const normalized = dateStr.trim().replace(/\//g, ".");
  const parts = normalized.split(".");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 100) year += 2000; // "26" → 2026
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  return date;
}

export function parseNumericBosnian(val: string | undefined | null): number {
  if (val === undefined || val === null || val.trim() === "" || val === "-") return 0;
  // Replace comma decimal separator with period
  const cleaned = val.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function getTotalUkupno(rows: PrimkaRow[]): number {
  return rows.reduce((sum, r) => sum + r.ukupno, 0);
}

export function getTotalCetinari(rows: PrimkaRow[]): number {
  return rows.reduce((sum, r) => sum + r.sigma_cetinari, 0);
}

export function getTotalLiscare(rows: PrimkaRow[]): number {
  return rows.reduce((sum, r) => sum + r.liscare, 0);
}

export function aggregateGrades(rows: PrimkaRow[]): GradeData[] {
  const sum = (key: keyof PrimkaRow) => rows.reduce((s, r) => s + (r[key] as number), 0)
  return [
    { name: 'FL', cetinari: sum('fl_c'), liscare: sum('fl_l'), ukupno: sum('fl_c') + sum('fl_l') },
    { name: 'I. kl.', cetinari: sum('i_c'), liscare: sum('i_l'), ukupno: sum('i_c') + sum('i_l') },
    { name: 'II. kl.', cetinari: sum('ii_c'), liscare: sum('ii_l'), ukupno: sum('ii_c') + sum('ii_l') },
    { name: 'III. kl.', cetinari: sum('iii_c'), liscare: sum('iii_l'), ukupno: sum('iii_c') + sum('iii_l') },
    { name: 'Trupci', cetinari: sum('trupci_c'), liscare: sum('trupci_l'), ukupno: sum('trupci_c') + sum('trupci_l') },
    { name: 'Ogrevno', cetinari: sum('cel_duga') + sum('cel_cijepana'), liscare: sum('ogr_dugi') + sum('ogr_cijepani') + sum('gule'), ukupno: sum('cel_duga') + sum('cel_cijepana') + sum('ogr_dugi') + sum('ogr_cijepani') + sum('gule') },
  ].filter(d => d.ukupno > 0)
}

export function aggregateRadilisteSummary(rows: PrimkaRow[]): RadilisteSummary[] {
  const map = new Map<string, RadilisteSummary>()
  for (const row of rows) {
    const key = row.radiliste || '—'
    const e = map.get(key)
    if (e) { e.totalUkupno += row.ukupno; e.totalCetinari += row.sigma_cetinari; e.totalLiscare += row.liscare; e.count += 1 }
    else { map.set(key, { radiliste: key, totalUkupno: row.ukupno, totalCetinari: row.sigma_cetinari, totalLiscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => b.totalUkupno - a.totalUkupno)
}

export function aggregateIzvođačSummary(rows: PrimkaRow[]): IzvođačSummary[] {
  const map = new Map<string, IzvođačSummary>()
  for (const row of rows) {
    const key = row.izvođač || '—'
    const e = map.get(key)
    if (e) { e.totalUkupno += row.ukupno; e.totalCetinari += row.sigma_cetinari; e.totalLiscare += row.liscare; e.count += 1 }
    else { map.set(key, { izvođač: key, totalUkupno: row.ukupno, totalCetinari: row.sigma_cetinari, totalLiscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => b.totalUkupno - a.totalUkupno)
}

export function aggregateOtpremacSummary(rows: OtpremaRow[]): OtpremacSummary[] {
  const map = new Map<string, OtpremacSummary>()
  for (const row of rows) {
    const key = row.otpremac || '—'
    const e = map.get(key)
    if (e) { e.totalUkupno += row.ukupno; e.totalCetinari += row.sigma_cetinari; e.totalLiscare += row.liscare; e.count += 1 }
    else { map.set(key, { otpremac: key, totalUkupno: row.ukupno, totalCetinari: row.sigma_cetinari, totalLiscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => b.totalUkupno - a.totalUkupno)
}

export function aggregateKupacSummary(rows: OtpremaRow[]): KupacSummary[] {
  const map = new Map<string, KupacSummary>()
  for (const row of rows) {
    const key = row.kupac || '—'
    const e = map.get(key)
    if (e) { e.totalUkupno += row.ukupno; e.totalCetinari += row.sigma_cetinari; e.totalLiscare += row.liscare; e.count += 1 }
    else { map.set(key, { kupac: key, totalUkupno: row.ukupno, totalCetinari: row.sigma_cetinari, totalLiscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => b.totalUkupno - a.totalUkupno)
}

export function aggregateOtpremaDailyTotals(rows: OtpremaRow[]): DailyTotal[] {
  const map = new Map<string, DailyTotal>()
  for (const row of rows) {
    const key = format(row.datum, 'yyyy-MM-dd')
    const e = map.get(key)
    if (e) { e.ukupno += row.ukupno; e.cetinari += row.sigma_cetinari; e.liscare += row.liscare }
    else { map.set(key, { datum: key, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare }) }
  }
  return Array.from(map.values()).sort((a, b) => a.datum.localeCompare(b.datum))
}

export function getTotalOtpremaUkupno(rows: OtpremaRow[]): number {
  return rows.reduce((sum, r) => sum + r.ukupno, 0)
}
export function getTotalOtpremaCetinari(rows: OtpremaRow[]): number {
  return rows.reduce((sum, r) => sum + r.sigma_cetinari, 0)
}
export function getTotalOtpremaLiscare(rows: OtpremaRow[]): number {
  return rows.reduce((sum, r) => sum + r.liscare, 0)
}

const MONTHS_BS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

export function aggregateByWeek(rows: OtpremaRow[]): PeriodTotal[] {
  const map = new Map<string, PeriodTotal>()
  for (const row of rows) {
    const week = getISOWeek(row.datum)
    const year = getISOWeekYear(row.datum)
    const sortKey = `${year}-W${String(week).padStart(2, '0')}`
    const label = `Sed. ${week}/${year}`
    const e = map.get(sortKey)
    if (e) { e.ukupno += row.ukupno; e.cetinari += row.sigma_cetinari; e.liscare += row.liscare; e.count += 1 }
    else { map.set(sortKey, { label, sortKey, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function aggregateByMonth(rows: OtpremaRow[]): PeriodTotal[] {
  const map = new Map<string, PeriodTotal>()
  for (const row of rows) {
    const month = getMonth(row.datum)
    const year = getYear(row.datum)
    const sortKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const label = `${MONTHS_BS[month]} ${year}`
    const e = map.get(sortKey)
    if (e) { e.ukupno += row.ukupno; e.cetinari += row.sigma_cetinari; e.liscare += row.liscare; e.count += 1 }
    else { map.set(sortKey, { label, sortKey, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function aggregateByQuarter(rows: OtpremaRow[]): PeriodTotal[] {
  const map = new Map<string, PeriodTotal>()
  for (const row of rows) {
    const q = getQuarter(row.datum)
    const year = getYear(row.datum)
    const sortKey = `${year}-Q${q}`
    const label = `Q${q} ${year}`
    const e = map.get(sortKey)
    if (e) { e.ukupno += row.ukupno; e.cetinari += row.sigma_cetinari; e.liscare += row.liscare; e.count += 1 }
    else { map.set(sortKey, { label, sortKey, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function aggregateByYear(rows: OtpremaRow[]): PeriodTotal[] {
  const map = new Map<string, PeriodTotal>()
  for (const row of rows) {
    const year = getYear(row.datum)
    const sortKey = `${year}`
    const e = map.get(sortKey)
    if (e) { e.ukupno += row.ukupno; e.cetinari += row.sigma_cetinari; e.liscare += row.liscare; e.count += 1 }
    else { map.set(sortKey, { label: sortKey, sortKey, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

function getPeriodKey(datum: Date, view: 'week' | 'month'): { sortKey: string; label: string } {
  if (view === 'week') {
    const week = getISOWeek(datum)
    const year = getISOWeekYear(datum)
    return { sortKey: `${year}-W${String(week).padStart(2, '0')}`, label: `Sed. ${week}/${year}` }
  }
  const month = getMonth(datum)
  const year = getYear(datum)
  return {
    sortKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: `${MONTHS_BS[month]} ${year}`,
  }
}

type PeriodRowBase = { datum: Date; sigma_cetinari: number; liscare: number; ukupno: number }

export function aggregatePeriodTotals<T extends PeriodRowBase>(rows: T[], view: 'week' | 'month'): PeriodTotal[] {
  const map = new Map<string, PeriodTotal>()
  for (const row of rows) {
    const { sortKey, label } = getPeriodKey(row.datum, view)
    const e = map.get(sortKey)
    if (e) { e.ukupno += row.ukupno; e.cetinari += row.sigma_cetinari; e.liscare += row.liscare; e.count += 1 }
    else { map.set(sortKey, { label, sortKey, ukupno: row.ukupno, cetinari: row.sigma_cetinari, liscare: row.liscare, count: 1 }) }
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

type SortimentRowBase = {
  datum: Date
  trupci_c: number; trupci_l: number; cel_duga: number; cel_cijepana: number
  ogr_dugi: number; ogr_cijepani: number; gule: number; skart: number; ukupno: number
}

export function aggregateSortimentiByPeriod<T extends SortimentRowBase>(rows: T[], view: 'week' | 'month'): PeriodSortimenti[] {
  const map = new Map<string, PeriodSortimenti>()
  for (const row of rows) {
    const { sortKey, label } = getPeriodKey(row.datum, view)
    const e = map.get(sortKey)
    if (e) {
      e.trupciC += row.trupci_c; e.trupciL += row.trupci_l
      e.celDuga += row.cel_duga; e.celCijepana += row.cel_cijepana
      e.ogrDugi += row.ogr_dugi; e.ogrCijepani += row.ogr_cijepani
      e.gule += row.gule; e.skart += row.skart; e.ukupno += row.ukupno
    } else {
      map.set(sortKey, {
        label, sortKey,
        trupciC: row.trupci_c, trupciL: row.trupci_l,
        celDuga: row.cel_duga, celCijepana: row.cel_cijepana,
        ogrDugi: row.ogr_dugi, ogrCijepani: row.ogr_cijepani,
        gule: row.gule, skart: row.skart, ukupno: row.ukupno,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}
