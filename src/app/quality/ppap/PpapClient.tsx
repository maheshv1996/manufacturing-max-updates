"use client";

import PageHeader from "@/app/components/shared/PageHeader";


import {logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Plus,
  Loader2,
  X,
  CheckCircle2,
  Pencil,
  FileCheck2,
  ListChecks,
  ShieldCheck
} from "lucide-react";

type Submission = any;
type ControlPlan = any;

const PPAP_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: {
    label: "Draft",
    cls: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  },
  IN_PROGRESS: {
    label: "In Progress",
    cls: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  },
  SUBMITTED: {
    label: "Submitted",
    cls: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  },
};

const CP_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: {
    label: "Draft",
    cls: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  },
  ACTIVE: {
    label: "Active",
    cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  },
  OBSOLETE: {
    label: "Obsolete",
    cls: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  },
};

const ELEMENT_STATUS: Record<string, { label: string; cls: string }> = {
  NOT_STARTED: { label: "Not Started", cls: "bg-slate-500/10 text-slate-400" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-blue-500/10 text-blue-400" },
  COMPLETE: { label: "Complete", cls: "bg-emerald-500/10 text-emerald-400" },
  N_A: { label: "N/A", cls: "bg-slate-500/10 text-slate-400" },
};

export default function PpapClient() {
  const [tab, setTab] = useState<"ppap" | "controlPlans">("ppap");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [controlPlans, setControlPlans] = useState<ControlPlan[]>([]);
  const [products, setProducts] = useState<
    { id: string; sku: string; name: string }[]
  >([]);
  const [, setPpapElements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{
    entity: "ppap" | "controlPlan";
    mode: "create" | "edit";
    row?: any;
  } | null>(null);
  const [form, setForm] = useState<any>({});
  const [detail, setDetail] = useState<Submission | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/ppap");
      if (res.ok) {
        const d = await res.json();
        setSubmissions(d.submissions || []);
        setControlPlans(d.controlPlans || []);
        setProducts(d.products || []);
        setPpapElements(d.ppapElements || []);
      }
    } catch (e) {
      logClientError(e, "PpapClient");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (detail) setDetail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, detail]);

  useEffect(() => {
    if (!detail && !modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (detail) setDetail(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, modal]);

  const api = async (entity: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/ppap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else {
        await fetchData();
        return d;
      }
    } catch (e) {
      logClientError(e, "PpapClient");
      alert("Action failed");
    } finally {
      setSaving(false);
    }
    return null;
  };

  const openCreatePpap = () => {
    setForm({
      productId: products[0]?.id || "",
      customerName: "",
      revision: "A",
      submissionLevel: "3",
    });
    setModal({ entity: "ppap", mode: "create" });
  };

  const openCreateCp = () => {
    setForm({
      productId: products[0]?.id || "",
      revision: "A",
      status: "DRAFT",
      processStep: "",
      characteristic: "",
      specMin: "",
      specMax: "",
      measurementMethod: "",
      sampleSize: "",
      frequency: "",
      controlMethod: "",
      reactionPlan: "",
      responsible: "",
    });
    setModal({ entity: "controlPlan", mode: "create" });
  };

  const openEditCp = (row: ControlPlan) => {
    setForm({
      id: row.id,
      productId: row.productId,
      revision: row.revision,
      status: row.status,
      processStep: row.processStep || "",
      characteristic: row.characteristic,
      specMin: row.specMin ?? "",
      specMax: row.specMax ?? "",
      measurementMethod: row.measurementMethod || "",
      sampleSize: row.sampleSize ?? "",
      frequency: row.frequency || "",
      controlMethod: row.controlMethod || "",
      reactionPlan: row.reactionPlan || "",
      responsible: row.responsible || "",
    });
    setModal({ entity: "controlPlan", mode: "edit", row });
  };

  const save = async () => {
    if (modal?.entity === "ppap") {
      const d = await api("ppap", { ...form });
      if (d) {
        setModal(null);
        setDetail(d.item);
      }
    } else {
      const d = await api("controlPlan", { ...form });
      if (d) setModal(null);
    }
  };

  const setElement = async (
    ppapId: string,
    elementNo: number,
    status: string,
  ) => {
    await api("element", { ppapId, elementNo, status });
    const d = await fetch("/api/ppap").then((r) => r.json());
    setDetail(d.submissions.find((s: any) => s.id === ppapId) || null);
  };

  const submit = async (id: string) => {
    await api("submit", { id });
    setDetail(null);
  };

  const disposition = async (id: string, disposition: string) => {
    await api("disposition", { id, disposition });
    setDetail(null);
  };

  const input =
    "w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">PPAP & Control Plans</h2>
          <p className="text-slate-400 text-sm">
            Production Part Approval Process (AIAG 18 elements) and live Control
            Plans per product — the IATF/AS9100 evidence package.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "ppap" ? (
            <Link
              href="/reports/ppap-register"
              className="inline-flex items-center gap-2 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-600"
            >
              <ClipboardCheck className="w-4 h-4" /> PPAP Register
            </Link>
          ) : (
            <Link
              href="/reports/control-plan"
              className="inline-flex items-center gap-2 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-600"
            >
              <ClipboardCheck className="w-4 h-4" /> Control Plan Sheet
            </Link>
          )}
          <button
            onClick={tab === "ppap" ? openCreatePpap : openCreateCp}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />{" "}
            {tab === "ppap" ? "New PPAP" : "New Control Plan Row"}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("ppap")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === "ppap" ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-600 text-slate-300 border border-slate-600"}`}
        >
          <FileCheck2 className="w-4 h-4" /> PPAP Submissions{" "}
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/10">
            {submissions.length}
          </span>
        </button>
        <button
          onClick={() => setTab("controlPlans")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === "controlPlans" ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-600 text-slate-300 border border-slate-600"}`}
        >
          <ListChecks className="w-4 h-4" /> Control Plans{" "}
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/10">
            {controlPlans.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : tab === "ppap" ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  PPAP No.
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Product
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Customer
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Level
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  18-Element Progress
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200 text-right">
                  Manage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/90/20">
                  <td className="px-5 py-3 font-mono font-bold text-white">
                    {s.ppapNumber}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{s.product?.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {s.product?.sku}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-slate-300">
                    {s.customerName || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 font-black">
                      {s.submissionLevel}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 bg-slate-800/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${s.completionPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        {s.completionPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${PPAP_STATUS[s.status]?.cls}`}
                    >
                      {PPAP_STATUS[s.status]?.label || s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setDetail(s)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-500/10 hover:text-blue-500"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-slate-400 italic"
                  >
                    No PPAP submissions yet.
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
                  Plan No.
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Product
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Process Step
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Characteristic
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">Spec</th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Method
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Sample / Freq
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200 text-right">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {controlPlans.map((cp) => (
                <tr key={cp.id} className="hover:bg-slate-800/90/20">
                  <td className="px-5 py-3 font-mono font-bold text-white">
                    {cp.planNumber}{" "}
                    <span className="text-xs text-slate-400">
                      Rev {cp.revision}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{cp.product?.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {cp.product?.sku}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-slate-300">
                    {cp.processStep || "—"}
                  </td>
                  <td className="px-5 py-3 font-medium text-white">
                    {cp.characteristic}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600 text-slate-300">
                    {cp.specMin !== null && cp.specMin !== undefined
                      ? `${cp.specMin} – ${cp.specMax ?? "∞"}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 text-slate-300">
                    {cp.measurementMethod || "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 text-slate-300">
                    {cp.sampleSize ? `${cp.sampleSize} pcs` : ""}
                    {cp.frequency ? ` / ${cp.frequency}` : ""}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${CP_STATUS[cp.status]?.cls}`}
                    >
                      {CP_STATUS[cp.status]?.label || cp.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openEditCp(cp)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-500/10 hover:text-blue-500"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {controlPlans.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-slate-400 italic"
                  >
                    No control plan rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PPAP DETAIL DRAWER — 18 elements */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/50"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ppap-drawer-title"
        >
          <div
            className="w-full max-w-2xl h-full bg-slate-800/60 overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-800/80 border-b border-slate-700 backdrop-blur-sm px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 id="ppap-drawer-title" className="text-lg font-bold text-white">
                  {detail.ppapNumber} — {detail.product?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {detail.customerName || "No customer"} · Level{" "}
                  {detail.submissionLevel} · Rev {detail.revision}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/reports/psw/${detail.id}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
                >
                  Print PSW
                </Link>
                {detail.status === "IN_PROGRESS" && (
                  <button
                    onClick={() => submit(detail.id)}
                    disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-bold"
                  >
                    Submit for Approval
                  </button>
                )}
                {detail.status === "SUBMITTED" && (
                  <>
                    <button
                      onClick={() => disposition(detail.id, "APPROVED")}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-bold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => disposition(detail.id, "REJECTED")}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-bold"
                    >
                      Reject
                    </button>
                  </>
                )}
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded ${PPAP_STATUS[detail.status]?.cls}`}
                >
                  {PPAP_STATUS[detail.status]?.label || detail.status}
                </span>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="p-2 rounded-lg hover:bg-slate-800/90"
                  aria-label="Close detail drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="text-sm font-bold text-slate-200 mb-3 uppercase tracking-wider">
                AIAG 18-Element Checklist
              </div>
              <div className="space-y-1.5">
                {detail.elements?.map((el: any) => (
                  <div
                    key={el.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-800/60 border border-slate-600/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-800/60 text-[10px] font-black text-slate-500 shrink-0">
                        {el.elementNo}
                      </span>
                      <span className="text-sm text-slate-200 truncate">
                        {el.elementName}
                      </span>
                    </div>
                    <select
                      value={el.status}
                      onChange={(e) =>
                        setElement(detail.id, el.elementNo, e.target.value)
                      }
                      className={`text-xs font-bold px-2 py-1 rounded-lg border-0 ${ELEMENT_STATUS[el.status]?.cls} bg-slate-800/60 cursor-pointer`}
                    >
                      <option value="NOT_STARTED">Not Started</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETE">Complete</option>
                      <option value="N_A">N/A</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ppap-modal-title"
        >
          <div
            className="w-full max-w-2xl bg-slate-800/60 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800/60 z-10">
              <h3 id="ppap-modal-title" className="text-lg font-bold text-white">
                {modal.entity === "ppap"
                  ? "New PPAP Submission"
                  : modal.mode === "edit"
                    ? `Edit ${modal.row.planNumber}`
                    : "New Control Plan Row"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="p-2 rounded-lg hover:bg-slate-800/90"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {modal.entity === "ppap" ? (
                <>
                  <Field label="Product" required>
                    <select
                      className={input}
                      value={form.productId || ""}
                      onChange={(e) =>
                        setForm({ ...form, productId: e.target.value })
                      }
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Customer Name">
                    <input
                      className={input}
                      value={form.customerName || ""}
                      onChange={(e) =>
                        setForm({ ...form, customerName: e.target.value })
                      }
                      placeholder="e.g. Boeing Defense & Space"
                    />
                  </Field>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Revision">
                      <input
                        className={input}
                        value={form.revision || "A"}
                        onChange={(e) =>
                          setForm({ ...form, revision: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Submission Level">
                      <select
                        className={input}
                        value={form.submissionLevel || "3"}
                        onChange={(e) =>
                          setForm({ ...form, submissionLevel: e.target.value })
                        }
                      >
                        {[1, 2, 3, 4, 5].map((l) => (
                          <option key={l} value={String(l)}>
                            Level {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        className={input}
                        value={form.status || "DRAFT"}
                        onChange={(e) =>
                          setForm({ ...form, status: e.target.value })
                        }
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="IN_PROGRESS">In Progress</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Notes">
                    <textarea
                      rows={2}
                      className={input}
                      value={form.notes || ""}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Product" required>
                      <select
                        className={input}
                        value={form.productId || ""}
                        onChange={(e) =>
                          setForm({ ...form, productId: e.target.value })
                        }
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} · {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Process Step">
                      <input
                        className={input}
                        value={form.processStep || ""}
                        onChange={(e) =>
                          setForm({ ...form, processStep: e.target.value })
                        }
                        placeholder="e.g. OP20 Milling"
                      />
                    </Field>
                  </div>
                  <Field label="Characteristic" required>
                    <input
                      className={input}
                      value={form.characteristic || ""}
                      onChange={(e) =>
                        setForm({ ...form, characteristic: e.target.value })
                      }
                      placeholder="e.g. Bore diameter Ø25 ± 0.02"
                    />
                  </Field>
                  <div className="grid sm:grid-cols-4 gap-4">
                    <Field label="Spec Min">
                      <input
                        type="number"
                        step="any"
                        className={input}
                        value={form.specMin ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, specMin: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Spec Max">
                      <input
                        type="number"
                        step="any"
                        className={input}
                        value={form.specMax ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, specMax: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Sample Size">
                      <input
                        type="number"
                        className={input}
                        value={form.sampleSize ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, sampleSize: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Frequency">
                      <input
                        className={input}
                        value={form.frequency || ""}
                        onChange={(e) =>
                          setForm({ ...form, frequency: e.target.value })
                        }
                        placeholder="Every 10 pcs"
                      />
                    </Field>
                  </div>
                  <Field label="Measurement Method">
                    <input
                      className={input}
                      value={form.measurementMethod || ""}
                      onChange={(e) =>
                        setForm({ ...form, measurementMethod: e.target.value })
                      }
                      placeholder="e.g. CMM / Micrometer"
                    />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Control Method">
                      <input
                        className={input}
                        value={form.controlMethod || ""}
                        onChange={(e) =>
                          setForm({ ...form, controlMethod: e.target.value })
                        }
                        placeholder="e.g. X-bar R chart"
                      />
                    </Field>
                    <Field label="Reaction Plan">
                      <input
                        className={input}
                        value={form.reactionPlan || ""}
                        onChange={(e) =>
                          setForm({ ...form, reactionPlan: e.target.value })
                        }
                        placeholder="e.g. Stop & quarantine"
                      />
                    </Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Responsible">
                      <input
                        className={input}
                        value={form.responsible || ""}
                        onChange={(e) =>
                          setForm({ ...form, responsible: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Status">
                      <select
                        className={input}
                        value={form.status || "DRAFT"}
                        onChange={(e) =>
                          setForm({ ...form, status: e.target.value })
                        }
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="ACTIVE">Active</option>
                        <option value="OBSOLETE">Obsolete</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Revision">
                    <input
                      className={input + " w-32"}
                      value={form.revision || "A"}
                      onChange={(e) =>
                        setForm({ ...form, revision: e.target.value })
                      }
                    />
                  </Field>
                </>
              )}
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
                    !form.productId ||
                    (modal.entity === "controlPlan" && !form.characteristic)
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}{" "}
                  Save
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
      <PageHeader
        title="Ppap"
        description="Inspections, NCRs, audits and compliance control."
        icon={<ShieldCheck className="w-6 h-6" />}
        iconTone="emerald"
      />

      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
