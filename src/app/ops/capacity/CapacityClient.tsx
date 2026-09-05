"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addWeeks, subWeeks, parseISO, addDays } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import type { MachineCapacity, CapacityPlanCell } from "@/lib/capacityEngine";

export default function CapacityClient({
  startDateStr,
  machines,
  totalOverloadedDays,
  mostLoadedMachine,
}: {
  startDateStr: string;
  machines: MachineCapacity[];
  totalOverloadedDays: number;
  mostLoadedMachine: string | null;
}) {
  const router = useRouter();
  const startDate = parseISO(startDateStr);
  const endDate = addDays(startDate, 6);

  const [selectedCell, setSelectedCell] = useState<{
    machineName: string;
    cell: CapacityPlanCell;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedCell) {
        setSelectedCell(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCell]);

  const handlePrevWeek = () => {
    const prev = subWeeks(startDate, 1);
    router.push(`/ops/capacity?date=${prev.toISOString()}`);
  };

  const handleNextWeek = () => {
    const next = addWeeks(startDate, 1);
    router.push(`/ops/capacity?date=${next.toISOString()}`);
  };

  const dateKeys = Array.from({ length: 7 }).map((_, i) =>
    format(addDays(startDate, i), "yyyy-MM-dd"),
  );

  const getCellColor = (loadPct: number) => {
    if (loadPct === 0)
      return "bg-slate-50 text-slate-400 bg-slate-800/60 text-slate-600";
    if (loadPct < 70)
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 text-emerald-300";
    if (loadPct <= 100)
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 text-amber-300";
    return "bg-rose-100 text-rose-800 font-bold dark:bg-rose-900/40 text-rose-300";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-blue-600" />
            Capacity Heatmap
          </h1>
          <p className="text-slate-400 mt-1">
            Machine load forecasting based on open Work Orders.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-800/60 p-2 rounded-xl shadow-sm border border-slate-700">
          <button
            onClick={handlePrevWeek}
            className="p-2 hover:bg-slate-800/90 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold px-4">
            {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
          </span>
          <button
            onClick={handleNextWeek}
            className="p-2 hover:bg-slate-800/90 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="text-slate-500 font-semibold uppercase tracking-wider text-sm">
            Overloaded Machine-Days
          </div>
          <div
            className={`text-2xl font-black ${totalOverloadedDays > 0 ? "text-rose-600" : "text-emerald-600"}`}
          >
            {totalOverloadedDays}
          </div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="text-slate-500 font-semibold uppercase tracking-wider text-sm">
            Most Loaded Machine
          </div>
          <div className="text-xl font-bold text-white">
            {mostLoadedMachine || "None"}
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-600">
                <th className="p-4 font-bold text-slate-300 w-48 sticky left-0 bg-slate-800/60 z-10 shadow-[1px_0_0_0_#334155]">
                  Machine
                </th>
                {dateKeys.map((dk) => (
                  <th
                    key={dk}
                    className="p-4 font-bold text-center text-slate-300 min-w-[100px]"
                  >
                    {format(parseISO(dk), "EEE")}
                    <div className="text-xs font-normal text-slate-500">
                      {format(parseISO(dk), "MMM d")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {machines.map((m) => (
                <tr
                  key={m.machineId}
                  className="hover:bg-slate-800/90/50 transition-colors"
                >
                  <td className="p-4 sticky left-0 bg-slate-800/60 group-hover:bg-slate-800/50 z-10 shadow-[1px_0_0_0_#334155]">
                    <div className="font-bold text-white">{m.machineName}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {m.machineCode}
                    </div>
                  </td>
                  {dateKeys.map((dk) => {
                    const cell = m.days[dk];
                    if (!cell) return <td key={dk} className="p-4"></td>;
                    return (
                      <td key={dk} className="p-2 text-center">
                        <button
                          onClick={() =>
                            setSelectedCell({
                              machineName: m.machineName,
                              cell,
                            })
                          }
                          className={`w-full h-12 flex flex-col items-center justify-center rounded-lg transition-transform hover:scale-105 ${getCellColor(
                            cell.loadPct,
                          )}`}
                        >
                          <span className="text-sm">
                            {cell.loadPct > 0
                              ? `${Math.round(cell.loadPct)}%`
                              : "-"}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCell && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="capacity-load-details-title"
          onClick={() => setSelectedCell(null)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
              <div>
                <h3 id="capacity-load-details-title" className="text-lg font-black text-white">Load Details</h3>
                <p className="text-sm text-slate-500">
                  {selectedCell.machineName} on{" "}
                  {format(parseISO(selectedCell.cell.date), "MMM d, yyyy")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                aria-label="Close load details dialog"
                className="p-2 text-slate-400 hover:text-slate-600 hover:text-slate-300 hover:bg-slate-800/90 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 font-bold uppercase mb-1">
                    Load %
                  </div>
                  <div
                    className={`text-xl font-black ${selectedCell.cell.loadPct > 100 ? "text-rose-600" : "text-white"}`}
                  >
                    {Math.round(selectedCell.cell.loadPct)}%
                  </div>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 font-bold uppercase mb-1">
                    Loaded
                  </div>
                  <div className="text-xl font-black text-white">
                    {selectedCell.cell.loadedHours.toFixed(1)}h
                  </div>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 font-bold uppercase mb-1">
                    Capacity
                  </div>
                  <div className="text-xl font-black text-white">
                    {selectedCell.cell.availableHours}h
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-3">
                  Contributing Work Orders
                </h4>
                {selectedCell.cell.contributingWOs.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">
                    No scheduled work orders for this day.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedCell.cell.contributingWOs.map((wo, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 border border-slate-700 rounded-lg hover:border-blue-200 hover:border-blue-800 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-blue-400">
                            {wo.woNumber}
                          </div>
                          <div className="text-xs text-slate-500">
                            {wo.operation} (Qty: {wo.quantity})
                          </div>
                        </div>
                        <div className="font-mono text-sm font-bold text-slate-300">
                          {wo.hours.toFixed(1)}h
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
