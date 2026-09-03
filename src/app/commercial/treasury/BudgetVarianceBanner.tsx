"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function BudgetVarianceBanner() {
  const [overruns, setOverruns] = useState<any[]>([]);
  const [nearLimit, setNearLimit] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/register/budgetLines")
      .then((r) => r.json())
      .then((d) => {
        const rows: any[] = d.rows || [];
        const over: any[] = [];
        const near: any[] = [];
        for (const b of rows) {
          const allocated = Number(b.allocated) || 0;
          const spent = Number(b.spent) || 0;
          if (allocated <= 0) continue;
          const pct = (spent / allocated) * 100;
          if (spent > allocated) over.push({ ...b, pct });
          else if (pct >= 80) near.push({ ...b, pct });
        }
        setOverruns(over);
        setNearLimit(near);
      })
      .catch(() => {});
  }, []);

  if (overruns.length === 0 && nearLimit.length === 0) return null;

  return (
    <div className="space-y-3">
      {overruns.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-rose-400 mb-2">
            <AlertTriangle className="w-4 h-4" /> Budget Overruns
          </div>
          <div className="flex flex-wrap gap-2">
            {overruns.map((b) => (
              <span
                key={b.id}
                className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold"
              >
                {b.department} / {b.category} — {b.pct.toFixed(0)}% (₹
                {Number(b.spent).toLocaleString("en-IN")} of ₹
                {Number(b.allocated).toLocaleString("en-IN")})
              </span>
            ))}
          </div>
        </div>
      )}
      {nearLimit.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-amber-400 mb-2">
            <AlertTriangle className="w-4 h-4" /> Approaching Budget Limit
          </div>
          <div className="flex flex-wrap gap-2">
            {nearLimit.map((b) => (
              <span
                key={b.id}
                className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold"
              >
                {b.department} / {b.category} — {b.pct.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
