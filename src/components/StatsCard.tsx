import { cn, formatNumber } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number;
  unit?: string;
  description?: string;
  icon?: React.ReactNode;
  trend?: number; // percentage change
  className?: string;
  decimals?: number;
}

export function StatsCard({
  title,
  value,
  unit = "m³",
  description,
  icon,
  trend,
  className,
  decimals = 2,
}: StatsCardProps) {
  const trendPositive = trend !== undefined && trend >= 0;
  const trendText = trend !== undefined
    ? `${trendPositive ? "+" : ""}${trend.toFixed(1)}%`
    : null;

  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-forest-50 dark:bg-forest-900/30 flex items-center justify-center text-forest-600 dark:text-forest-400 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">
          {formatNumber(value, decimals)}
        </span>
        {unit && (
          <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">{unit}</span>
        )}
      </div>

      <div className="flex items-center gap-2 min-h-[1.25rem]">
        {trendText && (
          <span
            className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              trendPositive
                ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20"
                : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
            )}
          >
            {trendText}
          </span>
        )}
        {description && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{description}</span>
        )}
      </div>
    </div>
  );
}
