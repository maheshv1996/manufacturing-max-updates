"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, AlertTriangle } from "lucide-react";

export default function HourlyAndonClient() {
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/andon/hourly", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setRows(data.rows || []);
        setStats(data.stats || {});
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

  const hours = Array.from({ length: new Date().getHours() }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Machines tracked</div>
          <div className="text-2xl font-black text-white mt-1">
            {stats.machines ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">
            Machines with short hours
          </div>
          <div className="text-2xl font-black text-amber-300 mt-1">
            {stats.short ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Flagged (2+ short hours)</div>
          <div
            className={`text-2xl font-black mt-1 ${stats.flagged ? "text-rose-400" : "text-white"}`}
          >
            {stats.flagged ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Today</div>
          <div className="text-2xl font-black text-white mt-1">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {stats.flagged > 0 && (
        <div className="flex items-center gap-2 text-sm text-rose-200 bg-rose-950/40 border border-rose-700/60 rounded-xl px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>
            <b>Supervisor alert sent:</b>{" "}
            {(rows || [])
              .filter((r) => r.flagged)
              .map((r) => r.machineName)
              .join(", ")}{" "}
            missed target in 2+ hours — check the notification bell.
          </span>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading hourly andon…
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700/60">
                <th className="px-3 py-2 font-semibold sticky left-0 bg-slate-800/90 z-10">
                  Machine
                </th>
                <th className="px-2 py-2 font-semibold text-center">Tgt/h</th>
                {hours.map((h) => (
                  <th
                    key={h}
                    className="px-1 py-2 font-semibold text-center min-w-[44px]"
                  >
                    {h}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {rows.map((r) => (
                <tr key={r.machineId} className="hover:bg-slate-700/20">
                  <td className="px-3 py-2 font-medium text-white sticky left-0 bg-slate-800/90 z-10 whitespace-nowrap">
                    {r.machineName}
                    {r.flagged && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
                        <AlertTriangle className="h-2.5 w-2.5" /> FLAGGED
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-300">
                    {r.target}
                  </td>
                  {hours.map((h) => {
                    const cell = r.hours.find((x: any) => x.hour === h);
                    if (!cell) return <td key={h} className="px-1 py-2" />;
                    const pct =
                      r.target > 0
                        ? Math.min(100, (cell.actual / r.target) * 100)
                        : 0;
                    return (
                      <td key={h} className="px-1 py-2">
                        <div
                          className={`rounded-lg px-1 py-1.5 border text-center ${cell.short ? "bg-rose-500/15 border-rose-500/40" : "bg-emerald-500/10 border-emerald-500/30"}`}
                          title={`${cell.actual} of ${r.target} target`}
                        >
                          <div className="text-[11px] font-mono font-bold text-white">
                            {cell.actual}
                          </div>
                          <div className="h-1 rounded-full bg-slate-700/70 mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cell.short ? "bg-rose-500" : "bg-emerald-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <Activity className="h-3 w-3" /> Target = 3600 ÷ op cycle time
        (seconds). Actual = good + scrap logged by hour. The terminal shows the
        same HOURLY chip per active job.
      </p>
    </div>
  );
}
