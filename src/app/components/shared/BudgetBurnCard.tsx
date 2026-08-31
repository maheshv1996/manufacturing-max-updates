"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { IndianRupee, TrendingUp, ChevronRight } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";

interface BurnRow {
  id: string;
  department: string;
  category: string;
  allocated: number;
  spent: number;
  burnPct: number;
  overrun: boolean;
  remaining: number;
  notes: string | null;
}

export default function BudgetBurnCard() {
  const pathname = usePathname();
  const dept = DEPARTMENTS.find(
    (d) => pathname === d.hub || pathname.startsWith(d.hub + "/"),
  );
  const [rows, setRows] = useState<BurnRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!dept) return;
    try {
      const res = await fetch(`/api/cost-centers?dept=${dept.id}`);
      const data = await res.json();
      setRows(data.rows || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept?.id]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  if (!dept || loading) return null;
  if (rows.length === 0) return null;

  const allocated = rows.reduce((s, r) => s + r.allocated, 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const burnPct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
  const overrun = allocated > 0 && spent > allocated;

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden edge-light">
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
          <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <IndianRupee className="w-4 h-4" />
          </span>
          {dept.short} cost center
        </div>
        <Link
          href="/commercial/treasury"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Treasury <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <p
              className={`text-3xl font-black tabular-nums ${overrun ? "text-rose-400" : "text-white"}`}
            >
              ₹{spent.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              of ₹{allocated.toLocaleString("en-IN")} allocated · {burnPct}%
              burn
            </p>
          </div>
          {overrun ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-500/15 text-rose-300 border-rose-500/40">
              OVERRUN
            </span>
          ) : burnPct >= 80 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/40">
              NEAR LIMIT
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
              ON TRACK
            </span>
          )}
        </div>

        <div className="mt-4 h-2 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${overrun ? "bg-rose-500" : burnPct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, burnPct)}%` }}
          />
        </div>

        <div className="mt-4 space-y-2.5">
          {rows.map((r) => {
            const pct =
              r.allocated > 0 ? Math.round((r.spent / r.allocated) * 100) : 0;
            return (
              <div key={r.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-300">
                    {r.category}
                  </span>
                  <span
                    className={
                      r.overrun ? "text-rose-400 font-bold" : "text-slate-400"
                    }
                  >
                    ₹{r.spent.toLocaleString("en-IN")} / ₹
                    {r.allocated.toLocaleString("en-IN")} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/70 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.overrun ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
          <TrendingUp className="w-3 h-3" />
          FY budget from Finance — overruns flag your bell and the morning
          digest.
        </p>
      </div>
    </div>
  );
}
