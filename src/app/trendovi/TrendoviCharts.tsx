"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { StatsCard } from "@/components/StatsCard";
import { DateRangePicker } from "@/components/DateRangePicker";
import type { DateRange, DailyTotal } from "@/lib/types";

interface TrendoviChartsProps {
  primkaDailyTotals: DailyTotal[];
  otpremaDailyTotals: DailyTotal[];
  monthlyTotals: DailyTotal[];
  totalPrimka: number;
  totalOtprema: number;
  balance: number;
  initialRange: DateRange;
}

export function TrendoviCharts({
  primkaDailyTotals,
  otpremaDailyTotals,
  monthlyTotals,
  totalPrimka,
  totalOtprema,
  balance,
  initialRange,
}: TrendoviChartsProps) {
  const [range, setRange] = useState<DateRange>(initialRange);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRangeChange(newRange: DateRange) {
    setRange(newRange);
    const from = newRange.from.toISOString().slice(0, 10);
    const to = newRange.to.toISOString().slice(0, 10);
    startTransition(() => {
      router.push(`/trendovi?from=${from}&to=${to}`);
    });
  }

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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Ukupno posječeno"
          value={totalPrimka}
          unit="m³"
          description="sječa (primka)"
        />
        <StatsCard
          title="Ukupno otpremljeno"
          value={totalOtprema}
          unit="m³"
          description="otprema"
        />
        <StatsCard
          title="Balans"
          value={balance}
          unit="m³"
          description={balance >= 0 ? "posječeno > otpremljeno" : "otpremljeno > posječeno"}
          trend={totalOtprema > 0 ? (balance / totalOtprema) * 100 : undefined}
        />
      </div>

      {/* Sječa trend */}
      <TrendLineChart
        data={primkaDailyTotals}
        title="Dnevni trend sječe (m³)"
        height={320}
      />

      {/* Otprema trend */}
      {otpremaDailyTotals.length > 0 && (
        <TrendLineChart
          data={otpremaDailyTotals}
          title="Dnevni trend otpreme (m³)"
          height={320}
        />
      )}

      {/* Monthly trend */}
      {monthlyTotals.length > 1 && (
        <TrendLineChart
          data={monthlyTotals}
          title="Mjesečni trend sječe (m³)"
          height={280}
        />
      )}
    </div>
  );
}
