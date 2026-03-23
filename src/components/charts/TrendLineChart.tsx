"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { formatNumber } from "@/lib/utils";
import type { DailyTotal } from "@/lib/types";

interface TrendLineChartProps {
  data: DailyTotal[];
  title?: string;
  height?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  let displayDate = label ?? "";
  try {
    displayDate = format(parseISO(label ?? ""), "dd.MM.yyyy");
  } catch {
    // use raw label if parse fails
  }
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{displayDate}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {formatNumber(entry.value)} m³
          </span>
        </div>
      ))}
    </div>
  );
}

function formatXTick(tick: string): string {
  try {
    return format(parseISO(tick), "dd.MM");
  } catch {
    return tick;
  }
}

export function TrendLineChart({ data, title, height = 320 }: TrendLineChartProps) {
  // Determine tick interval to avoid overcrowding
  const tickInterval = Math.max(0, Math.floor(data.length / 10) - 1);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      {title && (
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis
            dataKey="datum"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatXTick}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatNumber(v, 0)}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            formatter={(value: string) => (
              <span style={{ color: "#6b7280" }}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="ukupno"
            name="Ukupno"
            stroke="#16a34a"
            strokeWidth={2}
            dot={data.length <= 60}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="cetinari"
            name="Četinari"
            stroke="#166534"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="liscare"
            name="Lišćari"
            stroke="#4ade80"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
