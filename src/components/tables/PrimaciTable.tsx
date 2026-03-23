import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PrimacSummary } from "@/lib/types";

interface PrimaciTableProps {
  data: PrimacSummary[];
}

type SortKey = keyof PrimacSummary;
type SortDir = "asc" | "desc";

export function PrimaciTable({ data }: PrimaciTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalUkupno");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    let filtered = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = data.filter((r) => r.primac.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return 0;
    });
  }, [data, sortKey, sortDir, search]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const totalUkupno = data.reduce((s, r) => s + r.totalUkupno, 0);
  const totalCetinari = data.reduce((s, r) => s + r.totalCetinari, 0);
  const totalLiscare = data.reduce((s, r) => s + r.totalLiscare, 0);
  const totalCount = data.reduce((s, r) => s + r.count, 0);

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "primac", label: "Primač", align: "left" },
    { key: "count", label: "Br. primki", align: "right" },
    { key: "totalCetinari", label: "Četinari (m³)", align: "right" },
    { key: "totalLiscare", label: "Lišćari (m³)", align: "right" },
    { key: "totalUkupno", label: "Ukupno (m³)", align: "right" },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <input
          type="search"
          placeholder="Pretraži primače..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-forest-400 dark:focus:ring-forest-500"
        />
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="pl-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider w-8">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap group",
                    col.align === "right" ? "text-right" : "text-left"
                  )}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <span className={cn("opacity-0 group-hover:opacity-50 transition-opacity", sortKey === col.key && "opacity-100 text-forest-500")}>
                      {sortKey === col.key
                        ? sortDir === "asc" ? "↑" : "↓"
                        : "↕"}
                    </span>
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">
                Detail
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((row, idx) => (
              <tr
                key={row.primac}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-100"
              >
                <td className="pl-4 py-3 text-gray-400 dark:text-gray-500 text-xs">
                  {idx + 1}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                  {row.primac || <span className="text-gray-400 italic">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {row.count}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatNumber(row.totalCetinari)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {formatNumber(row.totalLiscare)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                  {formatNumber(row.totalUkupno)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/primaci/${encodeURIComponent(row.primac)}`}
                    className="text-xs font-medium text-forest-600 dark:text-forest-400 hover:underline whitespace-nowrap"
                  >
                    Detalji →
                  </Link>
                </td>
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  Nema podataka za zadane kriterije.
                </td>
              </tr>
            )}
          </tbody>

          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 font-semibold">
                <td className="pl-4 py-3" />
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  Ukupno ({sorted.length} primača)
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {totalCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {formatNumber(totalCetinari)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {formatNumber(totalLiscare)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {formatNumber(totalUkupno)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
