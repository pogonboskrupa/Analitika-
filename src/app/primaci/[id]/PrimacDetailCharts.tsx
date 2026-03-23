"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/StatsCard";
import { VolumeBarChart } from "@/components/charts/VolumeBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { OdjelPieChart } from "@/components/charts/OdjelPieChart";
import { DateRangePicker } from "@/components/DateRangePicker";
import type { DateRange, DailyTotal, OdjelSummary } from "@/lib/types";

interface GradeItem {
  name: string;
  value: number;
}

interface PrimacDetailChartsProps {
  primac: string;
  totalUkupno: number;
  totalCetinari: number;
  totalLiscare: number;
  totalCount: number;
  dailyTotals: DailyTotal[];
  odjelBreakdown: OdjelSummary[];
  gradesCetinari: GradeItem[];
  gradesLiscare: GradeItem[];
  initialRange: DateRange;
}

export function PrimacDetailCharts({
  primac,
  totalUkupno,
  totalCetinari,
  totalLiscare,
  totalCount,
  dailyTotals,
  odjelBreakdown,
  gradesCetinari,
  gradesLiscare,
  initialRange,
}: PrimacDetailChartsProps) {
  const [range, setRange] = useState<DateRange>(initialRange);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRangeChange(newRange: DateRange) {
    setRange(newRange);
    const from = newRange.from.toISOString().slice(0, 10);
    const to = newRange.to.toISOString().slice(0, 10);
    startTransition(() => {
      router.push(`/primaci/${encodeURIComponent(primac)}?from=${from}&to=${to}`);
    });
  }

  // Reshape grades for bar charts
  const cetinariBar = gradesCetinari.map((g) => ({
    name: g.name,
    cetinari: g.value,
    liscare: 0,
    ukupno: g.value,
  }));
  const liscariBar = gradesLiscare.map((g) => ({
    name: g.name,
    cetinari: 0,
    liscare: g.value,
    ukupno: g.value,
  }));

  return (
    <div className={`space-y-6 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
      {/* Date filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={handleRangeChange} />
        {isPending && (
          <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">
            Učitavanje...
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Ukupno" value={totalUkupno} unit="m³" decimals={2} />
        <StatsCard
          title="Četinari"
          value={totalCetinari}
          unit="m³"
          description={`${totalUkupno > 0 ? ((totalCetinari / totalUkupno) * 100).toFixed(1) : 0}%`}
        />
        <StatsCard
          title="Lišćari"
          value={totalLiscare}
          unit="m³"
          description={`${totalUkupno > 0 ? ((totalLiscare / totalUkupno) * 100).toFixed(1) : 0}%`}
        />
        <StatsCard title="Broj primki" value={totalCount} unit="" decimals={0} />
      </div>

      {/* Trend chart */}
      <TrendLineChart data={dailyTotals} title="Dnevni trend" height={280} />

      {/* Odjel breakdown */}
      {odjelBreakdown.length > 0 && (
        <OdjelPieChart data={odjelBreakdown} title="Po odjelu" height={280} />
      )}

      {/* Grade breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cetinariBar.length > 0 && (
          <VolumeBarChart
            data={cetinariBar}
            title="Četinari po klasama (m³)"
            showLegend={false}
            height={260}
          />
        )}
        {liscariBar.length > 0 && (
          <VolumeBarChart
            data={liscariBar.map((d) => ({ ...d, cetinari: d.liscare, liscare: 0 }))}
            title="Lišćari po klasama (m³)"
            showLegend={false}
            height={260}
          />
        )}
      </div>
    </div>
  );
}
