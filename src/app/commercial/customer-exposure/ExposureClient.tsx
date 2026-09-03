"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useCallback, useEffect, useState } from "react";
import {
  Loader2,
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  Wallet,
  FileText
} from "lucide-react";

type Warning = "NONE" | "ATTENTION" | "CRITICAL";

interface ExposureRow {
  customerName: string;
  terms: string;
  termsDays: number;
  openOrders: number;
  openOrderValue: number;
  receivables: number;
  invoiceCount: number;
  overdueAmt: number;
  maxOverdueDays: number;
  oldestDue: string | null;
  exposure: number;
  warning: Warning;
}

const TERMS_OPTIONS = [
  "ADVANCE",
  "COD",
  "NET15",
  "NET30",
  "NET45",
  "NET60",
  "NET90",
];

export default function ExposureClient() {
  const [data, setData] = useState<{ rows: ExposureRow[]; totals: any } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/exposure");
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch (e: any) {
      setMsg(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setTerms = async (customerName: string, paymentTerms: string) => {
    setSaving(customerName);
    setMsg("");
    try {
      const res = await fetch("/api/exposure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-terms",
          customerName,
          paymentTerms,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`Terms set to ${paymentTerms} for ${customerName}`);
        await fetchData();
      } else {
        setMsg(json?.error || "Update failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Computing exposure…
      </div>
    );
  }

  const { rows, totals } = data || { rows: [], totals: {} as any };
  const chip = (w: Warning) =>
    w === "CRITICAL"
      ? "bg-rose-500/15 text-rose-300 border-rose-500/50"
      : w === "ATTENTION"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/50"
        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Exposure"
        description="Quotes, orders, receivables and commercial desk operations."
        icon={<FileText className="w-6 h-6" />}
        iconTone="amber"
      />

      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total exposure ₹",
            value: (totals.exposure || 0).toLocaleString(),
            icon: <TrendingUp className="h-5 w-5 text-sky-400" />,
          },
          {
            label: "Open orders ₹",
            value: (totals.openOrderValue || 0).toLocaleString(),
            icon: <Wallet className="h-5 w-5 text-blue-400" />,
          },
          {
            label: "Receivables ₹",
            value: (totals.receivables || 0).toLocaleString(),
            icon: <Wallet className="h-5 w-5 text-violet-400" />,
          },
          {
            label: "Overdue ₹",
            value: (totals.overdueAmt || 0).toLocaleString(),
            icon: <AlertTriangle className="h-5 w-5 text-rose-400" />,
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
          </div>
        ))}
      </div>

      {(totals.critical || 0) > 0 && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-200 font-semibold">
            {totals.critical} customer
            {(totals.critical || 0) > 1 ? "s are" : " is"} past their payment
            terms — receivables at risk. Review before releasing further
            material.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Terms</th>
                <th className="py-3 px-4 text-right">Open orders</th>
                <th className="py-3 px-4 text-right">Order value</th>
                <th className="py-3 px-4 text-right">Receivables</th>
                <th className="py-3 px-4 text-right">Overdue</th>
                <th className="py-3 px-4 text-right">Max overdue</th>
                <th className="py-3 px-4 text-right">Exposure</th>
                <th className="py-3 px-4 text-center">Watch</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No open orders or receivables — clear books.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.customerName}
                  className="border-b border-slate-700/60 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-white">
                    {r.customerName}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={
                          TERMS_OPTIONS.includes(r.terms) ? r.terms : "NET30"
                        }
                        disabled={saving === r.customerName}
                        onChange={(e) =>
                          setTerms(r.customerName, e.target.value)
                        }
                        className={`bg-slate-900/80 border rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                          r.termsDays === 0 && r.warning !== "NONE"
                            ? "border-rose-500/50 text-rose-300"
                            : "border-slate-600 text-slate-200"
                        }`}
                      >
                        {TERMS_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {saving === r.customerName && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    {r.openOrders}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-300">
                    ₹{r.openOrderValue.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-violet-300">
                    ₹{r.receivables.toLocaleString()}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono ${r.overdueAmt > 0 ? "text-rose-300 font-bold" : "text-emerald-400"}`}
                  >
                    {r.overdueAmt > 0
                      ? `₹${r.overdueAmt.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {r.maxOverdueDays > 0 ? (
                      <span
                        className={`font-mono font-bold ${r.warning === "CRITICAL" ? "text-rose-300" : "text-amber-300"}`}
                      >
                        {r.maxOverdueDays}d
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-white">
                    ₹{r.exposure.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${chip(r.warning)}`}
                    >
                      {r.warning === "CRITICAL" ? (
                        <ShieldAlert className="h-3 w-3" />
                      ) : r.warning === "ATTENTION" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : null}
                      {r.warning}
                      {r.warning !== "NONE" &&
                        r.termsDays > 0 &&
                        ` · terms ${r.termsDays}d`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-600">
        Exposure = open work-orders (₹{totals.openOrderValue || 0}) +
        receivables (₹{totals.receivables || 0}). CRITICAL when overdue exceeds
        terms; ATTENTION when any invoice is overdue inside terms. Terms are
        saved to the customer master and audited.
      </p>
    </div>
  );
}
