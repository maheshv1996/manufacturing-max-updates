"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  FileText,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Printer,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Download,
} from "lucide-react";
import Link from "next/link";

type Structure = any;
type Payslip = any;

interface Field {
  key: string;
  label: string;
  type?: "text" | "number";
  required?: boolean;
  placeholder?: string;
}

const STRUCTURE_FIELDS: Field[] = [
  { key: "employeeName", label: "Employee Name", required: true },
  {
    key: "employeeCode",
    label: "Employee Code",
    required: true,
    placeholder: "e.g. EMP-004",
  },
  { key: "designation", label: "Designation" },
  { key: "basicPay", label: "Basic Pay (â‚¹)", type: "number" },
  { key: "hra", label: "HRA (â‚¹)", type: "number" },
  { key: "specialAllowance", label: "Special Allowance (â‚¹)", type: "number" },
  { key: "conveyance", label: "Conveyance (â‚¹)", type: "number" },
  { key: "otherAllowance", label: "Other Allowance (â‚¹)", type: "number" },
  {
    key: "pfPercent",
    label: "PF % (of basic, capped at â‚¹15,000)",
    type: "number",
  },
  {
    key: "professionalTax",
    label: "Professional Tax / month (â‚¹)",
    type: "number",
  },
  { key: "notes", label: "Notes" },
];

const grossOf = (s: any) =>
  (s?.basicPay || 0) +
  (s?.hra || 0) +
  (s?.specialAllowance || 0) +
  (s?.conveyance || 0) +
  (s?.otherAllowance || 0);
const fmt = (v: number) => Number(v || 0).toLocaleString("en-IN");

export default function PayrollClient() {
  const [tab, setTab] = useState<"structures" | "payslips">("structures");
  const [structures, setStructures] = useState<Structure[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [modal, setModal] = useState<{ row: Structure | null } | null>(null);
  const [form, setForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/payroll");
      if (res.ok) {
        const d = await res.json();
        setStructures(d.structures || []);
        setPayslips(d.payslips || []);
        setRuns(d.runs || []);
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

  const api = async (entity: string, action: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else await fetchData();
      return d;
    } catch (e) {
      console.error(e);
      alert("Action failed");
      return {};
    } finally {
      setSaving(false);
    }
  };

  const openModal = (row: Structure | null) => {
    const init: any = {};
    for (const f of STRUCTURE_FIELDS) {
      const v = row?.[f.key];
      if (f.type === "number") init[f.key] = v ?? "";
      else init[f.key] = v ?? "";
    }
    setForm(init);
    setModal({ row });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const payload: any = { ...form };
    if (modal.row) payload.id = modal.row.id;
    await api("salaryStructures", modal.row ? "update" : "create", payload);
    setModal(null);
  };

  const del = async (row: Structure) => {
    if (!confirm("Delete this salary structure? Payslips will be removed too."))
      return;
    await api("salaryStructures", "delete", { id: row.id });
  };

  const generate = async () => {
    setMsg("");
    const d = await api("salaryStructures", "generate", { month });
    if (d.success)
      setMsg(
        `Generated payslips for ${month} â€” ${d.record?.generated || 0} employees. Draft created — a manager must approve & lock before export.`,
      );
  };

  // P23 — approval chain: DRAFT → APPROVED → LOCKED → export; post-lock = override + audit
  const run = runs.find((r) => r.month === month);
  const RUN_STYLE: Record<string, string> = {
    DRAFT: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    APPROVED: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    LOCKED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  };

  const approveRun = async () => {
    const reason = window.prompt("Approval reason (required)");
    if (!reason) return;
    const d = await api("", "approve-run", { month, reason });
    if (d?.run) setMsg(`Run ${month} APPROVED by ${d.run.approvedBy}.`);
  };
  const lockRun = async () => {
    const reason = window.prompt(
      "Lock reason (required) — export will only be allowed after this.",
    );
    if (!reason) return;
    const d = await api("", "lock-run", { month, reason });
    if (d?.run) setMsg(`Run ${month} LOCKED. CSV export is now allowed.`);
  };
  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/payroll/export?month=${month}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || `Export blocked for ${month}.`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed");
    }
  };
  const overrideSlip = async (p: Payslip) => {
    const reason = window.prompt(
      `Override payslip for ${p.salaryStructure?.employeeName}? Reason (required — audit)`,
    );
    if (!reason) return;
    const net = window.prompt("New net pay (₹)", String(p.netPay));
    if (net === null) return;
    const d = await api("", "override-payslip", {
      payslipId: p.id,
      month,
      reason,
      fields: { netPay: Number(net) },
    });
    if (d?.payslip) setMsg(`Payslip overridden — PAYROLL_OVERRIDE audited.`);
  };

  const monthPayslips = payslips.filter((p) => p.month === month);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap print:hidden">
        <button
          onClick={() => setTab("structures")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "structures"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Wallet className="w-4 h-4" /> Salary Structures
        </button>
        <button
          onClick={() => setTab("payslips")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "payslips"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <FileText className="w-4 h-4" /> Pay Slips
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : tab === "structures" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal(null)}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Structure
            </button>
          </div>
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-800/60 border-b border-slate-700">
                <tr>
                  {[
                    "Employee",
                    "Code",
                    "Designation",
                    "Basic",
                    "HRA",
                    "Other Allow.",
                    "Gross / mo",
                    "PF %",
                    "PT",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 font-semibold text-slate-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {structures.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-10 text-center text-slate-400 italic"
                    >
                      No salary structures yet.
                    </td>
                  </tr>
                )}
                {structures.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-5 py-3 font-bold text-white">
                      {s.employeeName}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                      {s.employeeCode}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {s.designation || "â€”"}
                    </td>
                    <td className="px-5 py-3 font-mono text-right">
                      {fmt(s.basicPay)}
                    </td>
                    <td className="px-5 py-3 font-mono text-right">
                      {fmt(s.hra)}
                    </td>
                    <td className="px-5 py-3 font-mono text-right">
                      {fmt(
                        (s.specialAllowance || 0) +
                          (s.conveyance || 0) +
                          (s.otherAllowance || 0),
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono font-black text-right text-emerald-400">
                      {fmt(grossOf(s))}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {s.pfPercent || 12}%
                    </td>
                    <td className="px-5 py-3 font-mono text-right">
                      {fmt(s.professionalTax)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(s)}
                          className="px-2.5 py-1.5 bg-slate-800/60 text-blue-400 rounded-lg text-xs font-bold"
                        >
                          <Pencil className="w-3.5 h-3.5 inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => del(s)}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-400 rounded-lg text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* P23 — approval chain panel */}
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white">
                  Approval chain — {month}
                </h3>
                {run ? (
                  <span
                    className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${RUN_STYLE[run.status] || RUN_STYLE.DRAFT}`}
                  >
                    {run.status}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold rounded-full border px-2 py-0.5 bg-slate-700/50 text-slate-400 border-slate-600">
                    NOT GENERATED
                  </span>
                )}
              </div>
              {run?.corrections?.length > 0 && (
                <span className="text-[11px] text-amber-400">
                  {run.corrections.length} override(s) on record
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Clerk generates the draft → manager approves → locks → CSV export.
              Any post-lock change is an override with a written reason + audit.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {run?.status === "DRAFT" && (
                <button
                  onClick={approveRun}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve run
                </button>
              )}
              {run?.status === "APPROVED" && (
                <button
                  onClick={lockRun}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" /> Lock run
                </button>
              )}
              <button
                onClick={exportCsv}
                disabled={saving || run?.status !== "LOCKED"}
                title={
                  run?.status !== "LOCKED"
                    ? "Approve & lock the run before export"
                    : "Download payroll CSV"
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <Link
                href={`/reports/payslips?month=${month}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/60 text-slate-200 rounded-lg font-medium border border-slate-600 hover:bg-slate-200 hover:bg-slate-700"
              >
                <Printer className="w-4 h-4" /> Print
              </Link>
            </div>
            {run?.status !== "LOCKED" && run && (
              <p className="text-[11px] text-slate-500 mt-2">
                Export is locked until the run reaches LOCKED ({run.status}{" "}
                now).
              </p>
            )}
          </div>

          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h3 className="font-bold text-white">
                Generate Monthly Pay Slips
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Computes gross, PF (min(basic, â‚¹15,000) Ã— PF% default 12),
                professional tax, and net pay for every structure. Re-running
                updates the month.
              </p>
              {msg && (
                <p className="text-sm font-semibold text-emerald-400 mt-2">
                  {msg}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-semibold text-white"
              />
              <button
                onClick={generate}
                disabled={saving || structures.length === 0}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />{" "}
                {saving ? "Generating..." : "Generate Month"}
              </button>
              <Link
                href={`/reports/payslips?month=${month}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/60 text-slate-200 rounded-lg font-medium border border-slate-600 hover:bg-slate-200 hover:bg-slate-700"
              >
                <Printer className="w-4 h-4" /> Print
              </Link>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-800/60 border-b border-slate-700">
                <tr>
                  {[
                    "Employee",
                    "Code",
                    "Designation",
                    "Month",
                    "Gross",
                    "PF Deduction",
                    "PT Deduction",
                    "Net Pay",
                    "Generated",
                    ...(run?.status === "LOCKED" ? ["Actions"] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 font-semibold text-slate-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {monthPayslips.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-slate-400 italic"
                    >
                      No payslips for {month} yet â€” click Generate Month.
                    </td>
                  </tr>
                )}
                {monthPayslips.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-5 py-3 font-bold text-white">
                      {p.salaryStructure?.employeeName}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                      {p.salaryStructure?.employeeCode}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {p.salaryStructure?.designation || "â€”"}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                      {p.month}
                    </td>
                    <td className="px-5 py-3 font-mono text-right">
                      {fmt(p.grossPay)}
                    </td>
                    <td className="px-5 py-3 font-mono text-right text-rose-500">
                      âˆ’{fmt(p.pfDeduction)}
                    </td>
                    <td className="px-5 py-3 font-mono text-right text-rose-500">
                      âˆ’{fmt(p.ptDeduction)}
                    </td>
                    <td className="px-5 py-3 font-mono font-black text-right text-emerald-400">
                      {fmt(p.netPay)}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {new Date(p.generatedAt).toLocaleDateString()}
                    </td>
                    {run?.status === "LOCKED" && (
                      <td className="px-5 py-3">
                        <button
                          onClick={() => overrideSlip(p)}
                          disabled={saving}
                          className="px-2.5 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-bold border border-amber-500/40 hover:bg-amber-500/25 disabled:opacity-50"
                        >
                          Override
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {modal.row ? "Edit" : "New"} Salary Structure
              </h3>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={save}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {STRUCTURE_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    {f.label}
                    {f.required ? " *" : ""}
                  </label>
                  <input
                    required={f.required}
                    type={f.type || "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, [f.key]: e.target.value })
                    }
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              ))}
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : modal.row ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
