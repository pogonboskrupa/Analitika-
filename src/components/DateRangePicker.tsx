import { useState } from "react";
import { format } from "date-fns";
import { getQuickSelectRange } from "@/lib/utils";
import type { DateRange, QuickSelect } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const QUICK_BUTTONS: { label: string; value: QuickSelect }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "YTD", value: "ytd" },
  { label: "Sve", value: "all" },
];

function toInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function fromInputValue(str: string): Date | null {
  if (!str) return null;
  const [year, month, day] = str.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [activeQuick, setActiveQuick] = useState<QuickSelect | null>(null);

  function handleQuick(qs: QuickSelect) {
    setActiveQuick(qs);
    onChange(getQuickSelectRange(qs));
  }

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = fromInputValue(e.target.value);
    if (parsed) {
      setActiveQuick(null);
      onChange({ from: parsed, to: value.to });
    }
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = fromInputValue(e.target.value);
    if (parsed) {
      setActiveQuick(null);
      onChange({ from: value.from, to: parsed });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick select buttons */}
      <div className="flex items-center gap-1">
        {QUICK_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            onClick={() => handleQuick(btn.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-150",
              activeQuick === btn.value
                ? "bg-forest-600 text-white border-forest-600 dark:bg-forest-500 dark:border-forest-500"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-forest-400 hover:text-forest-600 dark:hover:text-forest-400"
            )}
          >
            {btn.label}
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
          max={toInputValue(value.to)}
          className="text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-forest-400 dark:focus:ring-forest-500"
        />
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Do:</label>
        <input
          type="date"
          value={toInputValue(value.to)}
          onChange={handleToChange}
          min={toInputValue(value.from)}
          max={toInputValue(new Date())}
          className="text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-forest-400 dark:focus:ring-forest-500"
        />
      </div>
    </div>
  );
}
