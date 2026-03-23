import { Suspense } from "react";
import Link from "next/link";
import { getPrimkaData } from "@/lib/sheets";
import { aggregateDailyTotals, getQuickSelectRange } from "@/lib/utils";
import { PrimacDetailCharts } from "./PrimacDetailCharts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: { id: string };
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
      <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  );
}

export default async function PrimacDetailPage({ params }: PageProps) {
  const primac = decodeURIComponent(params.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/primaci" className="hover:text-forest-600 dark:hover:text-forest-400 transition-colors">
          Primači
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{primac}</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 truncate">{primac}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Detaljna analiza primača
        </p>
      </div>

      <Suspense fallback={<DetailSkeleton />}>
        <PrimacContent primac={primac} />
      </Suspense>
    </div>
  );
}

async function PrimacContent({ primac }: { primac: string }) {
  const defaultRange = getQuickSelectRange("90d");

  let allRows;
  try {
    allRows = await getPrimkaData(defaultRange.from, defaultRange.to);
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

  const rows = allRows.filter((r) => r.primac === primac);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Nema podataka za primača <strong>{primac}</strong> u odabranom periodu.
        </p>
        <Link
          href="/primaci"
          className="inline-block mt-3 text-sm text-forest-600 dark:text-forest-400 hover:underline"
        >
          ← Povratak na listu primača
        </Link>
      </div>
    );
  }

  const totalUkupno = rows.reduce((s, r) => s + r.ukupno, 0);
  const totalCetinari = rows.reduce((s, r) => s + r.sigma_cetinari, 0);
  const totalLiscare = rows.reduce((s, r) => s + r.liscare, 0);
  const dailyTotals = aggregateDailyTotals(rows);

  // Group by odjel for breakdown
  const byOdjel = new Map<string, number>();
  for (const row of rows) {
    byOdjel.set(row.odjel, (byOdjel.get(row.odjel) ?? 0) + row.ukupno);
  }
  const odjelBreakdown = Array.from(byOdjel.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([odjel, totalUkupno]) => ({ odjel, totalUkupno }));

  // Breakdown by wood grade for cetinari
  const gradesCetinari = [
    { name: "FL_C", value: rows.reduce((s, r) => s + r.fl_c, 0) },
    { name: "I/C", value: rows.reduce((s, r) => s + r.i_c, 0) },
    { name: "II/C", value: rows.reduce((s, r) => s + r.ii_c, 0) },
    { name: "III/C", value: rows.reduce((s, r) => s + r.iii_c, 0) },
    { name: "RD/C", value: rows.reduce((s, r) => s + r.rd_c, 0) },
    { name: "Trupci C", value: rows.reduce((s, r) => s + r.trupci_c, 0) },
    { name: "Cel. duga", value: rows.reduce((s, r) => s + r.cel_duga, 0) },
    { name: "Cel. cijep.", value: rows.reduce((s, r) => s + r.cel_cijepana, 0) },
    { name: "Škart", value: rows.reduce((s, r) => s + r.skart, 0) },
  ].filter((g) => g.value > 0);

  const gradesLiscare = [
    { name: "FL_L", value: rows.reduce((s, r) => s + r.fl_l, 0) },
    { name: "I/L", value: rows.reduce((s, r) => s + r.i_l, 0) },
    { name: "II/L", value: rows.reduce((s, r) => s + r.ii_l, 0) },
    { name: "III/L", value: rows.reduce((s, r) => s + r.iii_l, 0) },
    { name: "Trupci L", value: rows.reduce((s, r) => s + r.trupci_l, 0) },
    { name: "Ogr. dugi", value: rows.reduce((s, r) => s + r.ogr_dugi, 0) },
    { name: "Ogr. cijep.", value: rows.reduce((s, r) => s + r.ogr_cijepani, 0) },
    { name: "Gule", value: rows.reduce((s, r) => s + r.gule, 0) },
    { name: "Lišćari", value: rows.reduce((s, r) => s + r.liscare, 0) },
  ].filter((g) => g.value > 0);

  return (
    <PrimacDetailCharts
      primac={primac}
      totalUkupno={totalUkupno}
      totalCetinari={totalCetinari}
      totalLiscare={totalLiscare}
      totalCount={rows.length}
      dailyTotals={dailyTotals}
      odjelBreakdown={odjelBreakdown}
      gradesCetinari={gradesCetinari}
      gradesLiscare={gradesLiscare}
      initialRange={defaultRange}
    />
  );
}
