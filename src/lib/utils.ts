import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, startOfYear, subDays } from "date-fns";
import type { DateRange, QuickSelect, PrimkaRow, OtpremaRow, PrimacSummary, OdjelSummary, DailyTotal } from "./types";

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

  switch (qs) {
    case "7d":
      return { from: subDays(today, 6), to: today };
    case "30d":
      return { from: subDays(today, 29), to: today };
    case "90d":
      return { from: subDays(today, 89), to: today };
    case "ytd":
      return { from: startOfYear(today), to: today };
    case "all":
      return { from: new Date(2000, 0, 1), to: today };
  }
}

export function dateRangeToParams(range: DateRange): string {
  return `from=${format(range.from, "yyyy-MM-dd")}&to=${format(range.to, "yyyy-MM-dd")}`;
}

export function filterByDateRange<T extends { datum: Date }>(
  rows: T[],
  range: DateRange
): T[] {
  return rows.filter((row) => {
    const d = row.datum;
    return d >= range.from && d <= range.to;
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
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
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
