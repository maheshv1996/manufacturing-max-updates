"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PackageCheck,
  Plus,
  Loader2,
  X,
  CheckCircle2,
  FileText,
  Banknote,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type Grn = any;
type Invoice = any;
type Po = any;

const MATCH_META: Record<string, { label: string; cls: string }> = {
  UNMATCHED: {
    label: "Awaiting Invoice",
    cls: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  },
  PARTIAL: {
    label: "Partial Receipt",
    cls: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  },
  MATCHED: {
    label: "Matched âœ“",
    cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  },
  MISMATCHED: {
    label: "Mismatch!",
    cls: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  },
};

const INSPECT_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-amber-500/10 text-amber-400" },
  PASSED: { label: "Passed", cls: "bg-emerald-500/10 text-emerald-400" },
  REJECTED: { label: "Rejected", cls: "bg-rose-500/10 text-rose-400" },
};

const matchBadge = (k: string) =>
  MATCH_META[k]?.cls || MATCH_META.UNMATCHED.cls;

export default function GrnClient() {
  const [tab, setTab] = useState<"grn" | "invoices">("grn");
  const [grns, setGrns] = useState<Grn[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pos, setPos] = useState<Po[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [, setRawMaterials] = useState<
    { id: string; sku: string; name: string; unit: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{
    entity: "grn" | "invoice";
    row?: any;
  } | null>(null);
  const [form, setForm] = useState<any>({});
  const [cashflow, setCashflow] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/grn");
      if (res.ok) {
        const d = await res.json();
        setGrns(d.grns || []);
        setInvoices(d.invoices || []);
        setPos(d.pos || []);
        setSuppliers(d.suppliers || []);
        setRawMaterials(d.rawMaterials || []);
        setCashflow(d.cashflow || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (entity: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || "Action failed");
        return d;
      }
      await fetchData();
      return d;
    } catch (e) {
      console.error(e);
      alert("Action failed");
    } finally {
      setSaving(false);
    }
    return null;
  };

  const openReceive = () => {
    const firstPo = pos.find(
      (p) => p.status === "ORDERED" || p.status === "PARTIAL",
    );
    setForm({
      poId: firstPo?.id || (pos[0]?.id ?? ""),
      receivedQty: "",
      batchNo: "",
      notes: "",
    });
    setModal({ entity: "grn" });
  };

  const openInvoice = () => {
    const firstSupplier = suppliers[0];
    setForm({
      supplierId: firstSupplier?.id || "",
      poId: "",
      invoiceNumber: "",
      amount: "",
      taxAmount: "0",
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      notes: "",
    });
    setModal({ entity: "invoice" });
  };

  const save = async () => {
    if (modal?.entity === "grn") {
      const d = await api("grn", form);
      if (d?.success) setModal(null);
      else if (d?.error) alert(d.error);
    } else {
      const d = await api("invoice", form);
      if (d?.success) setModal(null);
      else if (d?.error) alert(d.error);
    }
  };

  const inspect = async (id: string, inspectionStatus: string) => {
    await api("inspect", { id, inspectionStatus });
  };

  const pay = async (id: string) => {
    const d = await api("pay", { id });
    if (d?.error) alert(d.error); // e.g. THREE_WAY_BLOCKED
  };

  const input =
    "w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm";

  const openPos = pos.filter((p) => ["ORDERED", "PARTIAL"].includes(p.status));

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Goods Receipt & 3-Way Match
          </h2>
          <p className="text-slate-400 text-sm">
            Receive stock against POs (GRN), capture supplier invoices, and
            match PO â‡„ GRN â‡„ Invoice before payment.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reports/grn-register"
            className="inline-flex items-center gap-2 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-600"
          >
            <PackageCheck className="w-4 h-4" /> GRN Register
          </Link>
          {tab === "grn" ? (
            <button
              onClick={openReceive}
              disabled={saving || openPos.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Receive Stock (GRN)
            </button>
          ) : (
            <button
              onClick={openInvoice}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> New Supplier Invoice
            </button>
          )}
        </div>
      </div>

      {/* PAYABLES AGING + CASH-FLOW FORECAST */}
      {cashflow && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 col-span-2 md:col-span-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Outstanding Payables
            </div>
            <div className="text-xl font-black font-mono mt-1 text-white">
              â‚¹{cashflow.outstandingTotal?.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-rose-500 mt-0.5">
              â‚¹{cashflow.overdueTotal?.toLocaleString("en-IN")} overdue
            </div>
          </div>
          {cashflow.buckets30?.map((b: any, _i: number) => (
            <div
              key={b.label}
              className={`p-4 rounded-xl bg-slate-800/60 border ${b.label === "Overdue" ? "border-rose-300 dark:border-rose-800/60" : "border-slate-700"}`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Due {b.label}
              </div>
              <div
                className={`text-lg font-black font-mono mt-1 ${b.label === "Overdue" && b.amount > 0 ? "text-rose-500" : "text-white"}`}
              >
                â‚¹{b.amount.toLocaleString("en-IN")}
              </div>
              <div className="h-1.5 mt-2 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${b.label === "Overdue" ? "bg-rose-500" : "bg-blue-500"}`}
                  style={{
                    width: cashflow.outstandingTotal
                      ? `${Math.min(100, (b.amount / cashflow.outstandingTotal) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3-WAY MATCH EXPLAINER */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            n: "1",
            label: "PO â€” Purchase Order",
            sub: "Qty & unit cost commitment",
            ok: true,
          },
          {
            n: "2",
            label: "GRN â€” Goods Receipt",
            sub: "What actually arrived",
            ok: true,
          },
          {
            n: "3",
            label: "Invoice â€” Supplier Bill",
            sub: "What the vendor billed",
            ok: true,
          },
        ].map((s) => (
          <div
            key={s.n}
            className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center gap-3"
          >
            <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 font-black text-lg shrink-0">
              {s.n}
            </span>
            <div>
              <div className="text-sm font-bold text-white">{s.label}</div>
              <div className="text-[11px] text-slate-500">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("grn")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === "grn" ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-600 text-slate-300 border border-slate-600"}`}
        >
          <PackageCheck className="w-4 h-4" /> Goods Receipt Notes{" "}
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/10">
            {grns.length}
          </span>
        </button>
        <button
          onClick={() => setTab("invoices")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === "invoices" ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-600 text-slate-300 border border-slate-600"}`}
        >
          <FileText className="w-4 h-4" /> Supplier Invoices{" "}
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/10">
            {invoices.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : tab === "grn" ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  GRN No.
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">PO</th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Supplier
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Material
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Received
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  PO Qty
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Inspection
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  3-Way Match
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Batch
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {grns.map((g) => (
                <tr key={g.id} className="hover:bg-slate-800/90/20">
                  <td className="px-5 py-3 font-mono font-bold text-white">
                    {g.grnNumber}
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                    {g.po?.poNumber}
                  </td>
                  <td className="px-5 py-3">{g.supplier?.name}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{g.rawMaterial?.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {g.rawMaterial?.sku}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono font-bold">
                    {g.receivedQty}{" "}
                    <span className="text-xs text-slate-500 font-normal">
                      {g.rawMaterial?.unit}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-500">
                    {g.po?.qty}
                  </td>
                  <td className="px-5 py-3">
                    {g.inspectionStatus === "PENDING" ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => inspect(g.id, "PASSED")}
                          className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-bold"
                        >
                          Pass
                        </button>
                        <button
                          onClick={() => inspect(g.id, "REJECTED")}
                          className="text-[10px] px-2 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${INSPECT_META[g.inspectionStatus]?.cls}`}
                      >
                        {INSPECT_META[g.inspectionStatus]?.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${matchBadge(g.matchStatus)}`}
                    >
                      {MATCH_META[g.matchStatus]?.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-500">
                    {g.batchNo || "â€”"}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-400">
                    {new Date(g.receivedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {grns.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-center text-slate-400 italic"
                  >
                    No GRNs yet. Receive stock against an open PO.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Invoice No.
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Supplier
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">PO</th>
                <th className="px-5 py-3 font-semibold text-slate-200">GRN</th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Net Amount
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">Tax</th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Total
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  3-Way Match
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200 text-right">
                  Pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`hover:bg-slate-800/90/20 ${inv.matchStatus === "MISMATCHED" ? "bg-rose-50/40 dark:bg-rose-950/20" : ""}`}
                >
                  <td className="px-5 py-3 font-mono font-bold text-white">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-5 py-3">{inv.supplier?.name}</td>
                  <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                    {inv.po?.poNumber || "â€”"}
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                    {inv.grn?.grnNumber || "â€”"}
                  </td>
                  <td className="px-5 py-3 font-mono">
                    â‚¹{inv.amount?.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-500">
                    â‚¹{inv.taxAmount?.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3 font-mono font-bold">
                    â‚¹{inv.totalAmount?.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3">
                    {inv.matchStatus === "MISMATCHED" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-3 h-3" /> Mismatch
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${matchBadge(inv.matchStatus)}`}
                      >
                        {MATCH_META[inv.matchStatus]?.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${inv.status === "PAID" ? "bg-emerald-500/10 text-emerald-400" : inv.status === "MISMATCHED" ? "bg-rose-500/10 text-rose-400" : "bg-slate-500/10 text-slate-400"}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {inv.status === "PAID" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" /> Paid
                      </span>
                    ) : (
                      <button
                        onClick={() => pay(inv.id)}
                        disabled={saving || inv.matchStatus !== "MATCHED"}
                        title={
                          inv.matchStatus !== "MATCHED"
                            ? "3-way match must be MATCHED before payment"
                            : "Pay invoice"
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Banknote className="w-3.5 h-3.5" /> Pay
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-center text-slate-400 italic"
                  >
                    No supplier invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Payment is hard-blocked until PO â‡„ GRN â‡„ Invoice all agree
            (3-way MATCHED).
          </div>
        </div>
      )}

      {/* RECEIVE MODAL */}
      {modal?.entity === "grn" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-slate-800/60 rounded-2xl shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Receive Stock (GRN)
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-2 rounded-lg hover:bg-slate-800/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Purchase Order" required>
                <select
                  className={input}
                  value={form.poId || ""}
                  onChange={(e) => setForm({ ...form, poId: e.target.value })}
                >
                  {pos
                    .filter((p) => ["ORDERED", "PARTIAL"].includes(p.status))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} Â· {p.supplier?.name} Â·{" "}
                        {p.rawMaterial?.name} ({p.qty} {p.rawMaterial?.unit},
                        received {p.receivedQty})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Received Quantity" required>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className={input}
                  value={form.receivedQty || ""}
                  onChange={(e) =>
                    setForm({ ...form, receivedQty: e.target.value })
                  }
                />
              </Field>
              <Field label="Batch No.">
                <input
                  className={input}
                  value={form.batchNo || ""}
                  onChange={(e) =>
                    setForm({ ...form, batchNo: e.target.value })
                  }
                  placeholder="e.g. HT-2608"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={2}
                  className={input}
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800/60 text-slate-600 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || !form.poId || !form.receivedQty}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}{" "}
                  Receive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {modal?.entity === "invoice" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-slate-800/60 rounded-2xl shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                New Supplier Invoice
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-2 rounded-lg hover:bg-slate-800/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Supplier" required>
                <select
                  className={input}
                  value={form.supplierId || ""}
                  onChange={(e) =>
                    setForm({ ...form, supplierId: e.target.value })
                  }
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Invoice Number" required>
                  <input
                    className={input}
                    value={form.invoiceNumber || ""}
                    onChange={(e) =>
                      setForm({ ...form, invoiceNumber: e.target.value })
                    }
                    placeholder="e.g. INV-2026-4412"
                  />
                </Field>
                <Field label="Linked PO">
                  <select
                    className={input}
                    value={form.poId || ""}
                    onChange={(e) => setForm({ ...form, poId: e.target.value })}
                  >
                    <option value="">â€” None â€”</option>
                    {pos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} Â· {p.supplier?.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Net Amount (â‚¹)" required>
                  <input
                    type="number"
                    step="any"
                    className={input}
                    value={form.amount || ""}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tax (â‚¹)">
                  <input
                    type="number"
                    step="any"
                    className={input}
                    value={form.taxAmount ?? "0"}
                    onChange={(e) =>
                      setForm({ ...form, taxAmount: e.target.value })
                    }
                  />
                </Field>
                <Field label="Invoice Date">
                  <input
                    type="date"
                    className={input}
                    value={form.invoiceDate || ""}
                    onChange={(e) =>
                      setForm({ ...form, invoiceDate: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Due Date">
                <input
                  type="date"
                  className={input}
                  value={form.dueDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800/60 text-slate-600 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={
                    saving ||
                    !form.supplierId ||
                    !form.invoiceNumber ||
                    form.amount === ""
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}{" "}
                  Save Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
