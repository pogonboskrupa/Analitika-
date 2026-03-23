import { Suspense } from "react";
import { getPrimkaData, getOtpremaData } from "@/lib/sheets";
import { aggregateDailyTotals, getQuickSelectRange } from "@/lib/utils";
import { TrendoviCharts } from "./TrendoviCharts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function TrendSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  );
}

export default async function TrendoviPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Trendovi</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Vremenski trendovi sječe i otpreme
        </p>
      </div>

      <Suspense fallback={<TrendSkeleton />}>
        <TrendoviContent />
      </Suspense>
    </div>
  );
}

async function TrendoviContent() {
  const defaultRange = getQuickSelectRange("90d");

  let primkaRows, otpremaRows;
  try {
    [primkaRows, otpremaRows] = await Promise.all([
      getPrimkaData(defaultRange.from, defaultRange.to),
      getOtpremaData(defaultRange.from, defaultRange.to),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
          Greška pri učitavanju podataka
        </h3>
        <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      </div>
    );
  }

  const primkaDailyTotals = aggregateDailyTotals(primkaRows);

  // Aggregate otprema daily totals
  const otpremaMap = new Map<string, { datum: string; ukupno: number; cetinari: number; liscare: number }>();
  for (const row of otpremaRows) {
    const key = row.datum.toISOString().slice(0, 10);
    const existing = otpremaMap.get(key);
    if (existing) {
      existing.ukupno += row.ukupno;
      existing.cetinari += row.sigma_cetinari;
      existing.liscare += row.liscare;
    } else {
      otpremaMap.set(key, {
        datum: key,
        ukupno: row.ukupno,
        cetinari: row.sigma_cetinari,
        liscare: row.liscare,
      });
    }
  }
  const otpremaDailyTotals = Array.from(otpremaMap.values()).sort((a, b) =>
    a.datum.localeCompare(b.datum)
  );

  // Monthly aggregation for primka
  const monthlyMap = new Map<string, { datum: string; ukupno: number; cetinari: number; liscare: number }>();
  for (const row of primkaRows) {
    const key = `${row.datum.getFullYear()}-${String(row.datum.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyMap.get(key);
    if (existing) {
      existing.ukupno += row.ukupno;
      existing.cetinari += row.sigma_cetinari;
      existing.liscare += row.liscare;
    } else {
      monthlyMap.set(key, {
        datum: key,
        ukupno: row.ukupno,
        cetinari: row.sigma_cetinari,
        liscare: row.liscare,
      });
    }
  }
  const monthlyTotals = Array.from(monthlyMap.values()).sort((a, b) =>
    a.datum.localeCompare(b.datum)
  );

  const totalPrimka = primkaRows.reduce((s, r) => s + r.ukupno, 0);
  const totalOtprema = otpremaRows.reduce((s, r) => s + r.ukupno, 0);
  const balance = totalPrimka - totalOtprema;

  return (
    <TrendoviCharts
      primkaDailyTotals={primkaDailyTotals}
      otpremaDailyTotals={otpremaDailyTotals}
      monthlyTotals={monthlyTotals}
      totalPrimka={totalPrimka}
      totalOtprema={totalOtprema}
      balance={balance}
      initialRange={defaultRange}
    />
  );
}
