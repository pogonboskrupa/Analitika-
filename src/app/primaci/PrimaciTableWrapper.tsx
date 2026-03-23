"use client";

import { useState, useCallback } from "react";
import { parseISO } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PrimaciTable } from "@/components/tables/PrimaciTable";
import { aggregatePrimacSummary, dateRangeToParams } from "@/lib/utils";
import type { DateRange, PrimacSummary, PrimkaRowSerialized } from "@/lib/types";

interface PrimaciTableWrapperProps {
  initialData: PrimacSummary[];
  initialRange: DateRange;
}

export function PrimaciTableWrapper({ initialData, initialRange }: PrimaciTableWrapperProps) {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [data, setData] = useState<PrimacSummary[]>(initialData);
  const [loading, setLoading] = useState(false);
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
      const rows = rawRows.map((r) => ({
        ...r,
        datum: parseISO(r.datum),
      }));
      setData(aggregatePrimacSummary(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleRangeChange(newRange: DateRange) {
    setRange(newRange);
    void fetchData(newRange);
  }

  return (
    <div className="space-y-4">
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

      <PrimaciTable data={data} />
    </div>
  );
}
