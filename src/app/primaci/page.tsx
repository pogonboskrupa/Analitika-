import { Suspense } from "react";
import { getPrimkaData } from "@/lib/sheets";
import { aggregatePrimacSummary, getQuickSelectRange } from "@/lib/utils";
import { PrimaciTableWrapper } from "./PrimaciTableWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-72 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="h-12 bg-gray-100 dark:bg-gray-800" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900" />
        ))}
      </div>
    </div>
  );
}

export default async function PrimaciPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Primači</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pregled svih primača sa ukupnim volumenima sjece
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <PrimaciContent />
      </Suspense>
    </div>
  );
}

async function PrimaciContent() {
  const defaultRange = getQuickSelectRange("30d");

  let summaries;
  try {
    const rows = await getPrimkaData(defaultRange.from, defaultRange.to);
    summaries = aggregatePrimacSummary(rows);
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

  return (
    <PrimaciTableWrapper
      initialData={summaries}
      initialRange={defaultRange}
    />
  );
}
