"use client";

import { useCallback, useEffect, useState } from "react";
import { Gauge, Loader2, AlertTriangle } from "lucide-react";

interface Cell {
  machineName: string;
  day: string;
  hours: number;
  loadPct: number;
  wos: string[];
}

export default function CapacityClient() {
  const [days, setDays] = useState<string[]>([]);
  const [grid, setGrid] = useState<any[]>([]);
  const [available, setAvailable] = useState(16);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [cell, setCell] = useState<Cell | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/capacity/finite", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setDays(data.days || []);
        setGrid(data.grid || []);
        setAvailable(data.availablePerDay || 16);
        setTotals(data.totals || {});
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">
            Available / machine / day
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {available}h
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">
            Overloaded day-cells (14d)
          </div>
          <div
            className={`text-2xl font-black mt-1 ${totals.overloadedCells ? "text-rose-400" : "text-white"}`}
          >
            {totals.overloadedCells ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Machines on strip</div>
          <div className="text-2xl font-black text-white mt-1">
            {grid.length}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Horizon</div>
          <div className="text-2xl font-black text-white mt-1">
            {days.length}d
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading capacity…
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700/60">
                <th className="px-3 py-2 font-semibold sticky left-0 bg-slate-800/90 z-10">
                  Machine
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="px-1 py-2 font-semibold text-center min-w-[52px]"
                  >
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {grid.map((g) => (
                <tr key={g.machineId} className="hover:bg-slate-700/20">
                  <td className="px-3 py-2 font-medium text-white sticky left-0 bg-slate-800/90 z-10 whitespace-nowrap">
                    {g.machineName}{" "}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {g.code}
                    </span>
                  </td>
                  {g.hours.map((h: number, di: number) => {
                    const pct = g.loadPct[di];
                    const over = pct > 100;
                    return (
                      <td key={di} className="px-1 py-2">
                        <button
                          onClick={() =>
                            setCell({
                              machineName: g.machineName,
                              day: days[di],
                              hours: h,
                              loadPct: pct,
                              wos: g.wos[di],
                            })
                          }
                          className={`w-full rounded-lg px-1 py-1.5 border text-center cursor-pointer transition-colors ${
                            over
                              ? "bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25"
                              : pct > 80
                                ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                                : "bg-slate-900/40 border-slate-700 hover:bg-slate-700/40"
                          }`}
                          title={`${g.machineName} · ${days[di]}: ${h}h (${pct}%)`}
                        >
                          <div className="text-[11px] font-mono font-bold text-white">
                            {Math.round(h * 10) / 10}h
                          </div>
                          <div className="h-1 rounded-full bg-slate-700/70 mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${over ? "bg-rose-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          {over && (
                            <AlertTriangle className="h-3 w-3 text-rose-400 mx-auto mt-1" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        Load = WO op hours (setup + cycle × qty) spread over each WO's planned
        start→end window. Red = over {available}h available/day.
      </p>

      {cell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCell(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-sky-500" />
              <h3 className="font-bold text-white">
                {cell.machineName} · {cell.day}
              </h3>
              <span
                className={`ml-auto text-xs font-black px-2 py-0.5 rounded ${cell.loadPct > 100 ? "bg-rose-600 text-white" : "bg-slate-700 text-slate-300"}`}
              >
                {cell.hours}h / {cell.loadPct}%
              </span>
            </div>
            {cell.wos.length === 0 ? (
              <p className="text-sm text-slate-400">
                No work orders load this day.
              </p>
            ) : (
              <div className="space-y-1.5">
                {cell.wos.map((w) => (
                  <div
                    key={w}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700"
                  >
                    <span className="font-mono text-sm font-bold text-white">
                      {w}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setCell(null)}
                className="px-4 py-2 rounded-xl bg-slate-700 text-sm font-semibold text-white hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
