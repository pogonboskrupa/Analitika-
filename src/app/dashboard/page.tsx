import { Suspense } from "react";
import { getPrimkaData } from "@/lib/sheets";
import {
  aggregatePrimacSummary,
  aggregateOdjelSummary,
  aggregateDailyTotals,
  getTotalUkupno,
  getTotalCetinari,
  getTotalLiscare,
  getQuickSelectRange,
} from "@/lib/utils";
import { StatsCard } from "@/components/StatsCard";
import { DashboardCharts } from "./DashboardCharts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  );
}

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pregled sjece i otpreme drvnih sortimenata
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  // Default: last 30 days
  const defaultRange = getQuickSelectRange("30d");

  let rows;
  try {
    rows = await getPrimkaData(defaultRange.from, defaultRange.to);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
          Greška pri učitavanju podataka
        </h3>
        <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        <p className="text-xs text-red-500 dark:text-red-500 mt-2">
          Provjerite da je GOOGLE_SERVICE_ACCOUNT_KEY ispravno postavljen u .env.local
        </p>
      </div>
    );
  }

  const totalUkupno = getTotalUkupno(rows);
  const totalCetinari = getTotalCetinari(rows);
  const totalLiscare = getTotalLiscare(rows);
  const primacSummaries = aggregatePrimacSummary(rows);
  const odjelSummaries = aggregateOdjelSummary(rows);
  const dailyTotals = aggregateDailyTotals(rows);

  // Top 10 primači for bar chart
  const top10Primaci = primacSummaries.slice(0, 10).map((p) => ({
    name: p.primac,
    cetinari: p.totalCetinari,
    liscare: p.totalLiscare,
    ukupno: p.totalUkupno,
  }));

  const kpiIcons = {
    ukupno: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    cetinari: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polygon points="12 2 19 21 12 17 5 21 12 2" />
      </svg>
    ),
    liscare: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </svg>
    ),
    count: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  };

  return (
    <DashboardCharts
      totalUkupno={totalUkupno}
      totalCetinari={totalCetinari}
      totalLiscare={totalLiscare}
      totalCount={rows.length}
      top10Primaci={top10Primaci}
      odjelSummaries={odjelSummaries}
      dailyTotals={dailyTotals}
      kpiIcons={kpiIcons}
      initialRange={defaultRange}
    />
  );
}
