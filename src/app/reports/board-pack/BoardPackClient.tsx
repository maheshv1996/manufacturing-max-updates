"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  LayoutGrid,
  IndianRupee,
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  Siren,
} from "lucide-react";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function BoardPackClient() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/board-pack?month=${month}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Failed to load");
        setLoading(false);
        return;
      }
      setData(d);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deltaBadge = (pct: number | null, invert: boolean = false) => {
    if (pct === null)
      return <span className="text-slate-500 text-xs">vs prev: —</span>;
    const bad = invert ? pct < 0 : pct > 0;
    return (
      <span
        className={`text-xs font-semibold ${bad ? "text-red-300" : "text-emerald-300"}`}
      >
        {pct > 0 ? "▲" : pct < 0 ? "▼" : "="} {Math.abs(pct)}% vs prev
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
            <LayoutGrid className="w-4 h-4" /> M32 — Board Pack
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Monthly Management Pack
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Auto-compiled live from registers at open time ·{" "}
            {data?.compiledAt
              ? `compiled ${new Date(data.compiledAt).toLocaleString("en-IN")}`
              : ""}
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
        />
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                <IndianRupee className="w-4 h-4" /> Financials — {data.month}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[
                  {
                    label: "Invoiced",
                    value: fmt(data.financials.invoiced),
                    sub: deltaBadge(data.financials.invoiceDeltaPct),
                  },
                  {
                    label: "Collected",
                    value: fmt(data.financials.collected),
                    sub: (
                      <span className="text-xs text-slate-500">
                        {data.financials.invoiceCount} invoice(s)
                      </span>
                    ),
                  },
                  {
                    label: "Outstanding",
                    value: fmt(data.financials.outstanding),
                    sub: (
                      <span className="text-xs text-slate-500">
                        {data.financials.receivableCount} receivable(s)
                      </span>
                    ),
                  },
                  {
                    label: "Prev invoiced",
                    value: fmt(data.financials.prevInvoiced),
                    sub: (
                      <span className="text-xs text-slate-500">
                        prior month
                      </span>
                    ),
                  },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl bg-slate-900/50 border border-slate-700/60 p-3"
                  >
                    <div className="text-[11px] text-slate-400">{k.label}</div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {k.value}
                    </div>
                    <div className="mt-0.5">{k.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
                <TrendingUp className="w-4 h-4" /> Pipeline & Order Intake
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[
                  {
                    label: "Quotes sent",
                    value: `${data.pipeline.sentCount}`,
                    sub: (
                      <span className="text-xs text-slate-500">
                        value {fmt(data.pipeline.sentValue)}
                      </span>
                    ),
                  },
                  {
                    label: "Won",
                    value: `${data.pipeline.wonCount}`,
                    sub: deltaBadge(data.pipeline.wonDeltaPct),
                  },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl bg-slate-900/50 border border-slate-700/60 p-3"
                  >
                    <div className="text-[11px] text-slate-400">{k.label}</div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {k.value}
                    </div>
                    <div className="mt-0.5">{k.sub}</div>
                  </div>
                ))}
                <div className="col-span-2 rounded-xl bg-slate-900/50 border border-slate-700/60 p-3">
                  <div className="text-[11px] text-slate-400">Won value</div>
                  <div className="text-lg font-bold text-emerald-300 mt-0.5">
                    {fmt(data.pipeline.wonValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-300 font-semibold">
                <ShieldAlert className="w-4 h-4" /> Quality
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {[
                  {
                    label: "NCRs (month)",
                    value: data.quality.ncrCount,
                    color: "text-white",
                  },
                  {
                    label: "Open complaints",
                    value: data.quality.openComplaints,
                    color: "text-red-300",
                  },
                  {
                    label: "Open 8D",
                    value: data.quality.open8d,
                    color: "text-amber-300",
                  },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl bg-slate-900/50 border border-slate-700/60 p-3"
                  >
                    <div className={`text-lg font-bold ${k.color}`}>
                      {k.value}
                    </div>
                    <div className="text-[11px] text-slate-400">{k.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-red-300 font-semibold">
                <Siren className="w-4 h-4" /> Open Escalations (
                {data.escalations.open})
              </div>
              <div className="flex gap-2 mt-3 text-xs">
                {Object.entries(data.escalations.bySeverity).map(([sev, n]) => (
                  <span
                    key={sev}
                    className={`px-2 py-1 rounded-full border font-semibold ${sev === "CRITICAL" ? "bg-red-500/20 text-red-300 border-red-500/40" : sev === "HIGH" ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "bg-slate-700/60 text-slate-300"}`}
                  >
                    {sev}: {n as number}
                  </span>
                ))}
              </div>
              {data.escalations.list.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {data.escalations.list.map((e: any) => (
                    <div
                      key={e.id}
                      className="flex justify-between text-xs text-slate-300 bg-slate-900/50 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="truncate">
                        {e.title || e.description || e.id}
                      </span>
                      <span className="text-slate-500 whitespace-nowrap ml-2">
                        {new Date(e.escalatedAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
              <AlertTriangle className="w-4 h-4" /> Compliance & Risk Flags (
              {data.risks.critical} critical · {data.risks.warning} warning)
            </div>
            {data.risks.top.length === 0 && (
              <div className="text-sm text-emerald-300 mt-3">
                No open flags — all clear.
              </div>
            )}
            <div className="grid gap-2 mt-3 sm:grid-cols-2">
              {data.risks.top.map((f: any, i: number) => (
                <div
                  key={i}
                  className={`rounded-xl border px-3 py-2 text-xs ${f.severity === "critical" ? "bg-red-500/10 border-red-500/40 text-red-200" : "bg-amber-500/10 border-amber-500/40 text-amber-200"}`}
                >
                  <div className="font-semibold">{f.label}</div>
                  {f.detail && (
                    <div className="text-slate-300 mt-0.5">{f.detail}</div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">
                    {f.category}
                    {f.href ? ` · ${f.href}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
