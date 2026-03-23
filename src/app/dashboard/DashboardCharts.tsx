"use client";

import { useState, useEffect, useCallback } from "react";
import { StatsCard } from "@/components/StatsCard";
import { DateRangePicker } from "@/components/DateRangePicker";
import { VolumeBarChart } from "@/components/charts/VolumeBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { OdjelPieChart } from "@/components/charts/OdjelPieChart";
import {
  aggregatePrimacSummary,
  aggregateOdjelSummary,
  aggregateDailyTotals,
  getTotalUkupno,
  getTotalCetinari,
  getTotalLiscare,
  dateRangeToParams,
} from "@/lib/utils";
import type { DateRange, PrimkaRowSerialized, OdjelSummary, DailyTotal } from "@/lib/types";
import { format, parseISO } from "date-fns";

interface Top10Item {
  name: string;
  cetinari: number;
  liscare: number;
  ukupno: number;
}

interface DashboardChartsProps {
  totalUkupno: number;
  totalCetinari: number;
  totalLiscare: number;
  totalCount: number;
  top10Primaci: Top10Item[];
  odjelSummaries: OdjelSummary[];
  dailyTotals: DailyTotal[];
  kpiIcons: Record<string, React.ReactNode>;
  initialRange: DateRange;
}

export function DashboardCharts({
  totalUkupno: initialUkupno,
  totalCetinari: initialCetinari,
  totalLiscare: initialLiscare,
  totalCount: initialCount,
  top10Primaci: initialTop10,
  odjelSummaries: initialOdjeli,
  dailyTotals: initialDailyTotals,
  kpiIcons,
  initialRange,
}: DashboardChartsProps) {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [loading, setLoading] = useState(false);

  const [totalUkupno, setTotalUkupno] = useState(initialUkupno);
  const [totalCetinari, setTotalCetinari] = useState(initialCetinari);
  const [totalLiscare, setTotalLiscare] = useState(initialLiscare);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [top10Primaci, setTop10Primaci] = useState(initialTop10);
  const [odjelSummaries, setOdjelSummaries] = useState(initialOdjeli);
  const [dailyTotals, setDailyTotals] = useState(initialDailyTotals);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (newRange: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const params = dateRangeToParams(newRange);
      const res = await fetch(`/api/primka?${params}`);
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const rawRows = await res.json() as PrimkaRowSerialized[];

      // Deserialize dates
      const rows = rawRows.map((r) => ({
        ...r,
        datum: parseISO(r.datum),
      }));

      setTotalUkupno(getTotalUkupno(rows));
      setTotalCetinari(getTotalCetinari(rows));
      setTotalLiscare(getTotalLiscare(rows));
      setTotalCount(rows.length);

      const summaries = aggregatePrimacSummary(rows);
      setTop10Primaci(
        summaries.slice(0, 10).map((p) => ({
          name: p.primac,
          cetinari: p.totalCetinari,
          liscare: p.totalLiscare,
          ukupno: p.totalUkupno,
        }))
      );
      setOdjelSummaries(aggregateOdjelSummary(rows));
      setDailyTotals(aggregateDailyTotals(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška pri učitavanju");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleRangeChange(newRange: DateRange) {
    setRange(newRange);
    void fetchData(newRange);
  }

  const rangeLabel = `${format(range.from, "dd.MM.yyyy")} – ${format(range.to, "dd.MM.yyyy")}`;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={handleRangeChange} />
        {loading && (
          <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">
            Učitavanje...
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Ukupno (primka)"
          value={totalUkupno}
          unit="m³"
          description={rangeLabel}
          icon={kpiIcons.ukupno}
        />
        <StatsCard
          title="Četinari"
          value={totalCetinari}
          unit="m³"
          description={`${totalUkupno > 0 ? ((totalCetinari / totalUkupno) * 100).toFixed(1) : "0"}% od ukupnog`}
          icon={kpiIcons.cetinari}
        />
        <StatsCard
          title="Lišćari"
          value={totalLiscare}
          unit="m³"
          description={`${totalUkupno > 0 ? ((totalLiscare / totalUkupno) * 100).toFixed(1) : "0"}% od ukupnog`}
          icon={kpiIcons.liscare}
        />
        <StatsCard
          title="Broj primki"
          value={totalCount}
          unit=""
          description="zapisi u periodu"
          icon={kpiIcons.count}
          decimals={0}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VolumeBarChart
          data={top10Primaci}
          title="Top 10 primača po volumenu"
          height={300}
        />
        <OdjelPieChart
          data={odjelSummaries}
          title="Volumen po odjelu"
          height={300}
        />
      </div>

      {/* Daily trend */}
      <TrendLineChart
        data={dailyTotals}
        title="Dnevni trend volumena"
        height={320}
      />
    </div>
  );
}
