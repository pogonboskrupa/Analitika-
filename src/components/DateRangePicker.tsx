import { useState } from "react";
import { format, subDays } from "date-fns";
import { getLastNDaysRange, getYearRange } from "@/lib/utils";
import type { DateRange } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  years?: number[];
}

const QUICK_DAYS = [1, 2, 3, 4, 5, 6, 7, 10, 30];

function toInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function fromInputValue(str: string): Date | null {
  if (!str) return null;
  const [year, month, day] = str.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getYesterday(): Date {
  const now = new Date();
  return subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
}

function matchesYear(value: DateRange, year: number): boolean {
  const start = new Date(year, 0, 1);
  if (value.from.getTime() !== start.getTime()) return false;
  const end = new Date(year, 11, 31);
  // current year: to should be yesterday or today
  const diffMs = Math.abs(value.to.getTime() - end.getTime());
  const diffMs2 = Math.abs(value.to.getTime() - getYesterday().getTime());
  return diffMs < 86400000 * 2 || (year === new Date().getFullYear() && diffMs2 < 86400000 * 2);
}

export function DateRangePicker({ value, onChange, years }: DateRangePickerProps) {
  const [activeDay, setActiveDay] = useState<number | null>(null);

  function handleQuick(days: number) {
    setActiveDay(days);
    onChange(getLastNDaysRange(days));
  }

  function handleYear(year: number) {
    setActiveDay(null);
    onChange(getYearRange(year));
  }

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = fromInputValue(e.target.value);
    if (parsed) {
      setActiveDay(null);
      onChange({ from: parsed, to: value.to });
    }
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = fromInputValue(e.target.value);
    if (parsed) {
      setActiveDay(null);
      onChange({ from: value.from, to: parsed });
    }
  }

  const yesterday = getYesterday();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Year buttons */}
        {years && years.length > 0 && (
          <>
            <div className="flex items-center gap-1">
              {years.map((y) => {
                const active = matchesYear(value, y);
                return (
                  <button
                    key={y}
                    onClick={() => handleYear(y)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-md border transition-all duration-150",
                      active
                        ? "bg-forest-600 text-white border-forest-600 dark:bg-forest-500 dark:border-forest-500"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-forest-400 hover:text-forest-600 dark:hover:text-forest-400"
                    )}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
            <span className="text-gray-300 dark:text-gray-600 select-none">|</span>
          </>
        )}

        {/* Quick select day buttons */}
        <div className="flex items-center gap-1">
          {QUICK_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => handleQuick(d)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-150",
                activeDay === d
                  ? "bg-forest-600 text-white border-forest-600 dark:bg-forest-500 dark:border-forest-500"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-forest-400 hover:text-forest-600 dark:hover:text-forest-400"
              )}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Divider */}
        <span className="text-gray-300 dark:text-gray-600 select-none">|</span>

        {/* Custom date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Od:</label>
          <input
            type="date"
            value={toInputValue(value.from)}
            onChange={handleFromChange}
            min="2023-01-01"
            max={toInputValue(value.to)}
            className="text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-forest-400 dark:focus:ring-forest-500"
          />
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Do:</label>
          <input
            type="date"
            value={toInputValue(value.to)}
            onChange={handleToChange}
            min={toInputValue(value.from)}
            max={toInputValue(yesterday)}
            className="text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-forest-400 dark:focus:ring-forest-500"
          />
        </div>
      </div>

      {/* Period label */}
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium pl-0.5">
        Period: {format(value.from, "dd.MM.yyyy")} – {format(value.to, "dd.MM.yyyy")}
      </p>
    </div>
  );
}
