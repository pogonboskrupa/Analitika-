import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import type { OdjelSummary } from "@/lib/types";

interface OdjelPieChartProps {
  data: OdjelSummary[];
  title?: string;
  height?: number;
}

const COLORS = [
  "#16a34a",
  "#15803d",
  "#166534",
  "#4ade80",
  "#86efac",
  "#bbf7d0",
  "#22c55e",
  "#14532d",
  "#052e16",
  "#dcfce7",
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; percent: number }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{item.name}</p>
      <p className="text-gray-500 dark:text-gray-400">
        {formatNumber(item.value)} m³{" "}
        <span className="text-gray-400">({(item.percent * 100).toFixed(1)}%)</span>
      </p>
    </div>
  );
}

interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: LabelProps) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function OdjelPieChart({ data, title, height = 300 }: OdjelPieChartProps) {
  // Limit to top 9 + Other
  const sorted = [...data].sort((a, b) => b.totalUkupno - a.totalUkupno);
  let chartData: OdjelSummary[];
  if (sorted.length > 9) {
    const top = sorted.slice(0, 9);
    const otherTotal = sorted.slice(9).reduce((s, d) => s + d.totalUkupno, 0);
    chartData = [...top, { odjel: "Ostalo", totalUkupno: otherTotal }];
  } else {
    chartData = sorted;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      {title && (
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="totalUkupno"
            nameKey="odjel"
            cx="50%"
            cy="50%"
            outerRadius="75%"
            labelLine={false}
            label={CustomLabel as React.FC<object>}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${entry.odjel}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            formatter={(value: string) => (
              <span style={{ color: "#6b7280" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
