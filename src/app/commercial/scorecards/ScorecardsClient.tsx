"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useState, useEffect, useCallback } from "react";
import { Loader2, Star, Plus,
  FileText
} from "lucide-react";

export default function ScorecardsClient() {
  const [scorecards, setScorecards] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    period: new Date().toISOString().slice(0, 7),
    ppm: "",
    otpPct: "",
    score: "",
    receivedAt: "",
    fileRef: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/scorecards");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setScorecards(d.scorecards || []);
      setStats(d.stats || {});
    } catch {
      setToast("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show]);

  const api = async (body: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Action failed");
        return false;
      }
      setToast("Saved");
      await fetchData();
      return true;
    } catch {
      setToast("Network error");
      return false;
    } finally {
      setSaving(false);
    }
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
      <PageHeader
        title="Scorecards"
        description="Quotes, orders, receivables and commercial desk operations."
        icon={<FileText className="w-6 h-6" />}
        iconTone="amber"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
            <Star className="w-4 h-4" /> M30 — Customer Scorecards
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            How Our Customers Score Us
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monthly customer-scored PPM and on-time delivery. Thresholds: PPM ≥
            1000 → warning, ≥ 5000 → critical; OTD &lt; 90% → warning, &lt; 70%
            → critical.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Record scorecard
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Scorecards", value: stats.total, color: "text-white" },
          {
            label: "This year",
            value: stats.thisYear,
            color: "text-slate-300",
          },
          {
            label: "Customers",
            value: stats.customers,
            color: "text-slate-300",
          },
          {
            label: "Avg PPM",
            value: stats.avgPpm ?? "—",
            color: "text-amber-300",
          },
          {
            label: "Avg OTD",
            value: stats.avgOtp != null ? `${stats.avgOtp}%` : "—",
            color: "text-emerald-300",
          },
          {
            label: "Flagged",
            value: stats.flagged,
            color: stats.flagged ? "text-red-300" : "text-emerald-300",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-3"
          >
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {stats.byPeriod?.length > 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            Trend by period
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stats.byPeriod.map((p: any) => (
              <div
                key={p.period}
                className="rounded-xl bg-slate-900/50 border border-slate-700/60 px-3 py-2"
              >
                <div className="text-xs font-semibold text-slate-300">
                  {p.period} · {p.count} card(s)
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-slate-400">
                    PPM: <b className="text-amber-300">{p.avgPpm ?? "—"}</b>
                  </span>
                  <span className="text-slate-400">
                    OTD:{" "}
                    <b className="text-emerald-300">
                      {p.avgOtp != null ? `${p.avgOtp}%` : "—"}
                    </b>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Number</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Period</th>
              <th className="p-3">PPM</th>
              <th className="p-3">OTD %</th>
              <th className="p-3">Score</th>
              <th className="p-3">Verdict</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {scorecards.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  No scorecards recorded yet.
                </td>
              </tr>
            )}
            {scorecards.map((s) => (
              <tr
                key={s.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-300">{s.scorecardNumber}</td>
                <td className="p-3 font-medium text-white">{s.customerName}</td>
                <td className="p-3 text-slate-300">{s.period}</td>
                <td className="p-3 text-slate-200">{s.ppm ?? "—"}</td>
                <td className="p-3 text-slate-200">{s.otpPct ?? "—"}</td>
                <td className="p-3 text-slate-200">{s.score ?? "—"}</td>
                <td className="p-3">
                  {s.verdict?.flag ? (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${s.verdict.severity === "critical" ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40"}`}
                    >
                      {s.verdict.severity.toUpperCase()} · {s.verdict.reason}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                      PASS
                    </span>
                  )}
                </td>
                <td className="p-3 text-slate-500 max-w-[180px] truncate">
                  {s.notes || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShow(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scorecard-title"
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="scorecard-title" className="font-semibold text-white">
                Record customer scorecard
              </h2>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <input
              placeholder="Customer name"
              value={form.customerName}
              onChange={(e) =>
                setForm({ ...form, customerName: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <input
              type="month"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="PPM"
                value={form.ppm}
                onChange={(e) => setForm({ ...form, ppm: e.target.value })}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                placeholder="OTD %"
                value={form.otpPct}
                onChange={(e) => setForm({ ...form, otpPct: e.target.value })}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                placeholder="Score 0-100"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <input
              placeholder="File ref (optional)"
              value={form.fileRef}
              onChange={(e) => setForm({ ...form, fileRef: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await api({
                    action: "create-scorecard",
                    data: form,
                  });
                  if (ok) {
                    setShow(false);
                    setForm({
                      customerName: "",
                      period: new Date().toISOString().slice(0, 7),
                      ppm: "",
                      otpPct: "",
                      score: "",
                      receivedAt: "",
                      fileRef: "",
                      notes: "",
                    });
                  }
                }}
                disabled={saving || !form.customerName || !form.period}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-slate-800 border border-slate-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
