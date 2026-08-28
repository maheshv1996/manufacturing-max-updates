"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeIndianRupee,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  TrendingUp,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Revision {
  id: string;
  revisionNumber: string;
  product: { sku: string; name: string; sellingPricePerUnit: number | null };
  oldPrice: number;
  newPrice: number;
  increasePct: number;
  effectiveDate: string;
  reason: string | null;
  status: string;
  approvedByName: string | null;
  approvedAt: string | null;
  createdByName: string;
}
interface DueItem extends Revision {
  nextDue: string;
  daysLeft: number;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  REJECTED: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export default function PriceRevisionsClient() {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [dueSoon, setDueSoon] = useState<DueItem[]>([]);
  const [products, setProducts] = useState<
    {
      id: string;
      sku: string;
      name: string;
      sellingPricePerUnit: number | null;
    }[]
  >([]);
  const [, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // create form
  const [createOpen, setCreateOpen] = useState(false);
  const [crProduct, setCrProduct] = useState("");
  const [crPrice, setCrPrice] = useState("");
  const [crDate, setCrDate] = useState("");
  const [crReason, setCrReason] = useState("");

  // annual form
  const [annualOpen, setAnnualOpen] = useState(false);
  const [anPct, setAnPct] = useState("7");
  const [anDate, setAnDate] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/price-revisions");
      const data = await res.json();
      setRevisions(data.revisions || []);
      setDueSoon(data.dueSoon || []);
      setProducts(data.products || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const act = async (action: string, payload: any) => {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/price-revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Done — ${action}`);
        await fetchAll();
      } else {
        setMsg(data.error || "Action failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Revisions on file",
            value: revisions.length,
            icon: <BadgeIndianRupee className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Approved (live prices)",
            value: revisions.filter((r) => r.status === "APPROVED").length,
            icon: <CheckCircle2 className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "Draft awaiting approval",
            value: revisions.filter((r) => r.status === "DRAFT").length,
            icon: <Plus className="h-5 w-5 text-amber-500" />,
          },
          {
            label: "Due within 30 days",
            value: dueSoon.length,
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: dueSoon.length > 0 ? "text-rose-400" : "text-emerald-400",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3"
          >
            {k.icon}
            <div>
              <p className={`text-2xl font-black text-white ${k.tone || ""}`}>
                {k.value}
              </p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Due alerts */}
      {dueSoon.length > 0 && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/40 p-5">
          <h3 className="font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Annual price reviews due —{" "}
            {dueSoon.length}
          </h3>
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {dueSoon.map((d) => (
              <div
                key={d.id}
                className="rounded-xl bg-slate-900/60 border border-rose-500/30 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-white">
                    {d.product.sku} — {d.product.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    ₹{d.oldPrice} → ₹{d.newPrice} ({d.increasePct}%) · next
                    review {new Date(d.nextDue).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${d.daysLeft <= 0 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                >
                  {d.daysLeft <= 0 ? "OVERDUE" : `${d.daysLeft}d left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setCrProduct("");
            setCrPrice("");
            setCrDate(today);
            setCrReason("");
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500/25 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New price revision
        </button>
        <button
          onClick={() => {
            setAnPct("7");
            setAnDate(today);
            setAnnualOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5" /> Apply annual increase (all
          products)
        </button>
      </div>

      {/* Register */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="font-bold text-white">Revision register</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="px-5 py-3">Revision</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3 text-right">Old ₹</th>
                <th className="px-3 py-3 text-right">New ₹</th>
                <th className="px-3 py-3 text-right">Δ%</th>
                <th className="px-3 py-3">Effective</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-5 py-3 font-semibold text-white">
                    {r.revisionNumber}
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {r.product.sku}
                    <span className="block text-[11px] text-slate-500">
                      {r.product.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-400">
                    ₹{r.oldPrice}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-300 font-semibold">
                    ₹{r.newPrice}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">
                    {r.increasePct}%
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {new Date(r.effectiveDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${STATUS_STYLE[r.status] || STATUS_STYLE.DRAFT}`}
                    >
                      {r.status}
                    </span>
                    {r.approvedByName && (
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        by {r.approvedByName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {r.status === "DRAFT" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const why = window.prompt(
                              "Approval reason (required)",
                            );
                            if (why) act("approve", { id: r.id, reason: why });
                          }}
                          className="rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-2 py-1 text-[11px] font-semibold hover:bg-emerald-500/25"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const why = window.prompt(
                              "Rejection reason (required)",
                            );
                            if (why) act("reject", { id: r.id, reason: why });
                          }}
                          className="rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/40 px-2 py-1 text-[11px] font-semibold hover:bg-rose-500/25"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {r.status === "APPROVED" && (
                      <span className="text-[11px] text-slate-500">
                        live on quotes
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {revisions.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    No revisions yet — create one or run the annual increase.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">New price revision</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Product
              </label>
              <Select
                value={crProduct}
                onChange={(e) => setCrProduct(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name} (₹{p.sellingPricePerUnit ?? 0})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  New price ₹
                </label>
                <Input
                  type="number"
                  value={crPrice}
                  onChange={(e) => setCrPrice(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Effective date
                </label>
                <Input
                  type="date"
                  value={crDate}
                  onChange={(e) => setCrDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Reason
              </label>
              <Input
                value={crReason}
                onChange={(e) => setCrReason(e.target.value)}
                placeholder="e.g. contractual 8% annual increase"
                className="mt-1.5"
              />
            </div>
            <Button
              disabled={busy || !crProduct || !crPrice || !crDate}
              onClick={() =>
                act("create", {
                  productId: crProduct,
                  newPrice: crPrice,
                  effectiveDate: crDate,
                  reason: crReason,
                }).then(() => setCreateOpen(false))
              }
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}{" "}
              Draft revision
            </Button>
          </div>
        </div>
      )}

      {/* Annual modal */}
      {annualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">
                Annual contractual increase
              </h3>
              <button
                onClick={() => setAnnualOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Creates a DRAFT revision for every active product — managers
              approve the list to make it the quote default.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Increase %
                </label>
                <Input
                  type="number"
                  value={anPct}
                  onChange={(e) => setAnPct(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Effective date
                </label>
                <Input
                  type="date"
                  value={anDate}
                  onChange={(e) => setAnDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <Button
              disabled={busy || !anPct || !anDate}
              onClick={() =>
                act("apply-annual", { pct: anPct, effectiveDate: anDate }).then(
                  () => setAnnualOpen(false),
                )
              }
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}{" "}
              Draft for {products.length} product(s)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
