"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Filter,
  Loader2,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Trophy,
} from "lucide-react";

const STAGE_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-500",
  SENT: "bg-blue-500",
  WON: "bg-emerald-500",
  LOST: "bg-rose-500",
  CONVERTED: "bg-purple-500",
};

export default function FunnelClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/enquiry-funnel");
      if (!res.ok) throw new Error((await res.json())?.error || "Failed");
      setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading funnel…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-rose-400 text-sm py-8">
        Could not load funnel. Check permissions.
      </p>
    );
  }

  const { stages, totals, reasons, idle, stale } = data;
  const maxCount = Math.max(1, ...stages.map((s: any) => s.count));
  const idleFor = (idle || []).filter(
    (q: any) => q.status === "DRAFT" || q.status === "SENT",
  );
  const staleIds = new Set((stale || []).map((q: any) => q.quoteNumber));

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Enquiries",
            value: totals.total,
            sub: `${totals.open} open`,
            icon: <Filter className="h-5 w-5 text-blue-400" />,
          },
          {
            label: "Win rate",
            value: `${totals.winRate}%`,
            sub: `${totals.won} of ${totals.decided} decided`,
            icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
          },
          {
            label: "Won value ₹",
            value: totals.wonValue.toLocaleString(),
            icon: <Trophy className="h-5 w-5 text-emerald-400" />,
          },
          {
            label: "Lost value ₹",
            value: totals.lostValue.toLocaleString(),
            icon: <TrendingDown className="h-5 w-5 text-rose-400" />,
          },
          {
            label: "Idle / stale",
            value: `${idleFor.length} / ${staleIds.size}`,
            icon: <Clock className="h-5 w-5 text-amber-400" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
          >
            <div className="flex items-center gap-2">
              {k.icon}
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
            <p className="text-2xl font-black text-white mt-1">{k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-500">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
        <h3 className="font-bold text-white mb-5">
          Conversion funnel — where enquiries go
        </h3>
        <div className="space-y-3">
          {stages.map((s: any, i: number) => {
            const pct = Math.round((s.count / maxCount) * 100);
            const prev = i > 0 ? stages[i - 1] : null;
            const conv =
              prev && prev.count > 0
                ? Math.round((s.count / prev.count) * 100)
                : null;
            const isNegative =
              s.stage === "LOST" && totals.won + totals.lost + 1 > 0 && i > 0;
            return (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-right">
                  <p className="text-xs font-extrabold text-white">{s.stage}</p>
                  {conv !== null && (
                    <p
                      className={`text-[10px] font-mono ${i === 0 ? "" : isNegative ? "text-rose-400" : "text-emerald-400"}`}
                    >
                      {i === 0 ? "" : conv}%
                    </p>
                  )}
                </div>
                <div
                  className={`h-9 rounded-lg border border-slate-600 flex items-center justify-end px-3 transition-all ${STAGE_STYLE[s.stage]}`}
                  style={{ width: `${Math.max(6, pct)}%` }}
                >
                  <span className="text-xs font-mono font-bold text-white">
                    {s.count}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0">
                  ₹{s.value.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Win/loss reasons */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
        <h3 className="font-bold text-white mb-4">Win / loss reasons</h3>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {reasons.map((r: any) => {
            const total = r.won + r.lost;
            if (total === 0) return null;
            const wonW = Math.round((r.won / total) * 100);
            return (
              <div key={r.reason}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-300">
                    {r.reason}
                  </span>
                  <span className="font-mono text-slate-400">
                    <span className="text-emerald-400">▲ {r.won}</span> ·{" "}
                    <span className="text-rose-400">▼ {r.lost}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${wonW}%` }}
                  />
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${100 - wonW}%` }}
                  />
                </div>
              </div>
            );
          })}
          {reasons.every((r: any) => r.won + r.lost === 0) && (
            <p className="text-sm text-slate-500">
              No decided enquiries with reasons recorded — mark quotes won/lost
              with a reason.
            </p>
          )}
        </div>
      </div>

      {/* Idle + stale */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" /> Idle ≥ 7 days (
            {idleFor.length})
          </h3>
          {idleFor.length === 0 && (
            <p className="text-sm text-slate-500">
              All open enquiries touched this week. 🎉
            </p>
          )}
          <div className="space-y-2">
            {idleFor.map((q: any) => (
              <div
                key={q.quoteNumber}
                className="flex items-center justify-between text-xs rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2"
              >
                <div>
                  <p className="font-bold text-white">{q.customerName}</p>
                  <p className="text-slate-500 font-mono">
                    {q.quoteNumber} · ₹{q.quotedPrice?.toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 font-bold ${staleIds.has(q.quoteNumber) ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                >
                  {q.daysIdle}d idle
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" /> Stale &gt; 30
            days ({staleIds.size})
          </h3>
          {staleIds.size === 0 && (
            <p className="text-sm text-slate-500">
              No enquiry left untouched for over a month.
            </p>
          )}
          <div className="space-y-2">
            {idleFor
              .filter((q: any) => staleIds.has(q.quoteNumber))
              .map((q: any) => (
                <div
                  key={q.quoteNumber}
                  className="flex items-center justify-between text-xs rounded-lg bg-rose-950/30 border border-rose-500/30 px-3 py-2"
                >
                  <div>
                    <p className="font-bold text-white">{q.customerName}</p>
                    <p className="text-rose-400/80 font-mono">
                      {q.quoteNumber} · {q.status} · ₹
                      {q.quotedPrice?.toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] text-rose-300 font-bold">
                    {q.daysIdle}d
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
