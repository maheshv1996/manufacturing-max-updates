"use client";

import PageHeader from "@/app/components/shared/PageHeader";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Plus,
  Loader2,
  Pencil,
  X,
  CheckCircle2,
  Users,
  MessageSquare,
  ShieldAlert,
  GitBranch,
  Wrench,
  ShieldCheck,
  BadgeCheck,
  Flag,
} from "lucide-react";

type Report = any;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  D1_TEAM: {
    label: "D1 Team",
    cls: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  },
  D2_PROBLEM: {
    label: "D2 Problem",
    cls: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  },
  D3_CONTAINMENT: {
    label: "D3 Containment",
    cls: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  },
  D4_ROOT_CAUSE: {
    label: "D4 Root Cause",
    cls: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
  },
  D5_CORRECTIVE: {
    label: "D5 Corrective",
    cls: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
  },
  D6_PREVENTIVE: {
    label: "D6 Preventive",
    cls: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30",
  },
  D7_VERIFY: {
    label: "D7 Verify",
    cls: "bg-teal-500/10 text-teal-400 border border-teal-500/30",
  },
  D8_CLOSURE: {
    label: "D8 Closure",
    cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  },
  CLOSED: {
    label: "Closed",
    cls: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  },
};

const SEVERITY_CLS: Record<string, string> = {
  LOW: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  HIGH: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
  CRITICAL: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
};

const D_STEPS = [
  "D1_TEAM",
  "D2_PROBLEM",
  "D3_CONTAINMENT",
  "D4_ROOT_CAUSE",
  "D5_CORRECTIVE",
  "D6_PREVENTIVE",
  "D7_VERIFY",
  "D8_CLOSURE",
  "CLOSED",
];

const badge = (k: string) =>
  STATUS_META[k]?.cls ||
  "bg-slate-500/10 text-slate-400 border border-slate-500/30";

export default function EightDClient() {
  const [items, setItems] = useState<Report[]>([]);
  const [ncrs, setNcrs] = useState<
    { id: string; ncrNumber: string; description: string; status: string }[]
  >([]);
  const [products, setProducts] = useState<
    { id: string; sku: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    row?: Report;
  } | null>(null);
  const [form, setForm] = useState<any>({});
  const [detail, setDetail] = useState<Report | null>(null);
  const [actionForm, setActionForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/eight-d");
      if (res.ok) {
        const d = await res.json();
        setItems(d.items || []);
        setNcrs(d.ncrs || []);
        setProducts(d.products || []);
      }
    } catch (e) {
      logClientError(e, "EightDClient");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (payload: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/eight-d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else {
        await fetchData();
        return d;
      }
    } catch (e) {
      logClientError(e, "EightDClient");
      alert("Action failed");
    } finally {
      setSaving(false);
    }
    return null;
  };

  const openCreate = () => {
    setForm({
      title: "",
      problemDescription: "",
      severity: "MEDIUM",
      ncrId: "",
      productId: "",
    });
    setModal({ mode: "create" });
  };

  const openEdit = (row: Report) => {
    const f: any = {
      title: row.title,
      problemDescription: row.problemDescription || "",
      severity: row.severity,
      ncrId: row.ncrId || "",
      productId: row.productId || "",
    };
    for (const k of [
      "teamMembers",
      "problemStatement",
      "containmentAction",
      "containmentOwner",
      "why1",
      "why2",
      "why3",
      "why4",
      "why5",
      "rootCauseSummary",
      "correctiveAction",
      "correctiveOwner",
      "preventiveAction",
      "preventiveOwner",
      "verificationMethod",
      "verifiedBy",
      "effectivenessScore",
      "closureSummary",
    ]) {
      f[k] = row[k] ?? "";
    }
    for (const k of ["containmentDue", "correctiveDue", "preventiveDue"]) {
      f[k] = row[k] ? new Date(row[k]).toISOString().slice(0, 10) : "";
    }
    setForm(f);
    setModal({ mode: "edit", row });
  };

  const save = async () => {
    const payload: any = { data: { ...form } };
    if (modal?.row) payload.data.id = modal.row.id;
    if (modal?.mode === "edit" && form.status)
      payload.data.status = form.status;
    const d = await api(payload);
    if (d) {
      setModal(null);
      if (modal?.mode === "edit") setDetail(d.item);
    }
  };

  const advanceStatus = async (row: Report) => {
    const idx = D_STEPS.indexOf(row.status);
    const next = D_STEPS[Math.min(idx + 1, D_STEPS.length - 1)];
    const d = await api({ data: { id: row.id, status: next } });
    if (d && detail?.id === row.id) setDetail(d.item);
  };

  const addAction = async (reportId: string) => {
    if (!actionForm.description) return alert("Action description required");
    await api({
      entity: "action",
      data: { reportId, ...actionForm, status: "OPEN" },
    });
    setActionForm({});
    const d = await fetch(`/api/eight-d`).then((r) => r.json());
    setDetail(d.items.find((i: any) => i.id === reportId) || null);
  };

  const setActionStatus = async (
    actionId: string,
    status: string,
    reportId: string,
  ) => {
    await api({ entity: "actionStatus", data: { id: actionId, status } });
    const d = await fetch(`/api/eight-d`).then((r) => r.json());
    setDetail(d.items.find((i: any) => i.id === reportId) || null);
  };

  const input =
    "w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            8D Problem Solving & CAPA
          </h2>
          <p className="text-slate-400 text-sm">
            Eight-discipline reports linked to NCRs, with containment, root
            cause (5-Why), corrective/preventive actions and effectiveness
            closure.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reports/eight-d-register"
            className="inline-flex items-center gap-2 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-600"
          >
            <ClipboardCheck className="w-4 h-4" /> Printable Register
          </Link>
          <button
            onClick={openCreate}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New 8D Report
          </button>
        </div>
      </div>

      {/* SUMMARY CHIPS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Reports
          </div>
          <div className="text-2xl font-black mt-1 text-white">
            {items.length}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Open (D1–D7)
          </div>
          <div className="text-2xl font-black mt-1 text-amber-500">
            {
              items.filter((i) => !["D8_CLOSURE", "CLOSED"].includes(i.status))
                .length
            }
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Closed
          </div>
          <div className="text-2xl font-black mt-1 text-emerald-500">
            {items.filter((i) => i.status === "CLOSED").length}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Critical / High
          </div>
          <div className="text-2xl font-black mt-1 text-rose-500">
            {
              items.filter(
                (i) =>
                  ["HIGH", "CRITICAL"].includes(i.severity) &&
                  i.status !== "CLOSED",
              ).length
            }
          </div>
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400 italic bg-slate-800/60 rounded-2xl border border-slate-700">
          No 8D reports yet. Create one from an open NCR.
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Report
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Linked NCR
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Severity
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Stage
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Actions
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200 text-right">
                  Manage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/90/20">
                  <td className="px-5 py-3">
                    <div className="font-bold text-white">{r.reportNumber}</div>
                    <div className="text-xs text-slate-500 max-w-[280px] truncate">
                      {r.title}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {r.ncr ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        {r.ncr.ncrNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${SEVERITY_CLS[r.severity] || SEVERITY_CLS.MEDIUM}`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${badge(r.status)}`}
                    >
                      {STATUS_META[r.status]?.label || r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs text-slate-500">
                      {r.actions?.length || 0} CAPA action(s)
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => {
                          setDetail(r);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-500/10 hover:text-blue-500"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-500/10 hover:text-blue-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => advanceStatus(r)}
                        disabled={r.status === "CLOSED"}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-500 disabled:opacity-40"
                        title="Advance to next discipline"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50">
          <div className="w-full max-w-3xl h-full bg-slate-800/60 overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-800/80 border-b border-slate-700 backdrop-blur-sm px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {detail.reportNumber} — {detail.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Raised by {detail.raisedBy} ·{" "}
                  {new Date(detail.raisedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/reports/eight-d/${detail.id}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
                >
                  Print Report
                </Link>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded ${badge(detail.status)}`}
                >
                  {STATUS_META[detail.status]?.label || detail.status}
                </span>
                <button
                  onClick={() => setDetail(null)}
                  className="p-2 rounded-lg hover:bg-slate-800/90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* D1 Team */}
              <Section icon={<Users className="w-4 h-4" />} title="D1 — Team">
                <p className="text-sm text-slate-600 text-slate-300">
                  {detail.teamMembers || (
                    <span className="text-slate-400 italic">Not defined</span>
                  )}
                </p>
              </Section>

              {/* D2 Problem */}
              <Section
                icon={<MessageSquare className="w-4 h-4" />}
                title="D2 — Problem Description"
              >
                <p className="text-sm text-slate-600 text-slate-300">
                  {detail.problemDescription || detail.problemStatement || (
                    <span className="text-slate-400 italic">Not defined</span>
                  )}
                </p>
              </Section>

              {/* D3 Containment */}
              <Section
                icon={<ShieldAlert className="w-4 h-4" />}
                title="D3 — Containment"
              >
                <p className="text-sm text-slate-600 text-slate-300">
                  {detail.containmentAction || (
                    <span className="text-slate-400 italic">Not defined</span>
                  )}
                </p>
                {detail.containmentOwner && (
                  <p className="text-xs text-slate-500 mt-1">
                    Owner: {detail.containmentOwner}
                    {detail.containmentDue
                      ? ` · Due ${new Date(detail.containmentDue).toLocaleDateString()}`
                      : ""}
                  </p>
                )}
              </Section>

              {/* D4 Root cause */}
              <Section
                icon={<GitBranch className="w-4 h-4" />}
                title="D4 — Root Cause (5-Why)"
              >
                <WhyTree report={detail} />
                {detail.rootCauseSummary && (
                  <p className="text-sm font-semibold text-white mt-3">
                    Root cause: {detail.rootCauseSummary}
                  </p>
                )}
                {detail.why1 && <Fishbone report={detail} />}
              </Section>

              {/* D5 + D6 */}
              <div className="grid md:grid-cols-2 gap-4">
                <Section
                  icon={<Wrench className="w-4 h-4" />}
                  title="D5 — Corrective Action"
                >
                  <p className="text-sm text-slate-600 text-slate-300">
                    {detail.correctiveAction || (
                      <span className="text-slate-400 italic">Not defined</span>
                    )}
                  </p>
                  {detail.correctiveOwner && (
                    <p className="text-xs text-slate-500 mt-1">
                      Owner: {detail.correctiveOwner}
                      {detail.correctiveDue
                        ? ` · Due ${new Date(detail.correctiveDue).toLocaleDateString()}`
                        : ""}
                    </p>
                  )}
                </Section>
                <Section
                  icon={<ShieldCheck className="w-4 h-4" />}
                  title="D6 — Preventive Action"
                >
                  <p className="text-sm text-slate-600 text-slate-300">
                    {detail.preventiveAction || (
                      <span className="text-slate-400 italic">Not defined</span>
                    )}
                  </p>
                  {detail.preventiveOwner && (
                    <p className="text-xs text-slate-500 mt-1">
                      Owner: {detail.preventiveOwner}
                      {detail.preventiveDue
                        ? ` · Due ${new Date(detail.preventiveDue).toLocaleDateString()}`
                        : ""}
                    </p>
                  )}
                </Section>
              </div>

              {/* D7 */}
              <Section
                icon={<CheckCircle2 className="w-4 h-4" />}
                title="D7 — Verification"
              >
                <p className="text-sm text-slate-600 text-slate-300">
                  {detail.verificationMethod || (
                    <span className="text-slate-400 italic">Not defined</span>
                  )}
                </p>
                {detail.verifiedAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    Verified by {detail.verifiedBy || "—"} on{" "}
                    {new Date(detail.verifiedAt).toLocaleString()}
                  </p>
                )}
              </Section>

              {/* D8 */}
              <Section
                icon={<BadgeCheck className="w-4 h-4" />}
                title="D8 — Closure & Effectiveness"
              >
                <p className="text-sm text-slate-600 text-slate-300">
                  {detail.closureSummary || (
                    <span className="text-slate-400 italic">Not defined</span>
                  )}
                </p>
                {detail.effectivenessScore && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Effectiveness
                    </span>
                    <div className="h-2 w-40 bg-slate-800/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${Number(detail.effectivenessScore) >= 8 ? "bg-emerald-500" : Number(detail.effectivenessScore) >= 5 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{
                          width: `${Number(detail.effectivenessScore) * 10}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold">
                      {detail.effectivenessScore}/10
                    </span>
                  </div>
                )}
              </Section>

              {/* CAPA ACTIONS */}
              <Section
                icon={<ClipboardCheck className="w-4 h-4" />}
                title="CAPA Actions"
              >
                <div className="space-y-2">
                  {detail.actions?.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-600"
                    >
                      <div>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${a.type === "CONTAINMENT" ? "bg-amber-500/10 text-amber-400" : a.type === "CORRECTIVE" ? "bg-purple-500/10 text-purple-400" : "bg-indigo-500/10 text-indigo-400"}`}
                        >
                          {a.type}
                        </span>
                        <p className="text-sm text-slate-200 mt-1">
                          {a.description}
                        </p>
                        {(a.owner || a.dueDate) && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {a.owner}
                            {a.owner && a.dueDate ? " · " : ""}
                            {a.dueDate
                              ? `Due ${new Date(a.dueDate).toLocaleDateString()}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.status !== "VERIFIED" && (
                          <button
                            onClick={() =>
                              setActionStatus(
                                a.id,
                                a.status === "OPEN" ? "IN_PROGRESS" : "DONE",
                                detail.id,
                              )
                            }
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          >
                            {a.status === "OPEN"
                              ? "Start"
                              : a.status === "IN_PROGRESS"
                                ? "Done"
                                : ""}
                          </button>
                        )}
                        {a.status === "DONE" && (
                          <button
                            onClick={() =>
                              setActionStatus(a.id, "VERIFIED", detail.id)
                            }
                            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          >
                            Verify
                          </button>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${a.status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}
                        >
                          {a.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <select
                    value={actionForm.type || "CORRECTIVE"}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, type: e.target.value })
                    }
                    className={input + " w-36"}
                  >
                    <option value="CONTAINMENT">Containment</option>
                    <option value="CORRECTIVE">Corrective</option>
                    <option value="PREVENTIVE">Preventive</option>
                  </select>
                  <input
                    placeholder="Action description"
                    value={actionForm.description || ""}
                    onChange={(e) =>
                      setActionForm({
                        ...actionForm,
                        description: e.target.value,
                      })
                    }
                    className={input}
                  />
                  <input
                    placeholder="Owner"
                    value={actionForm.owner || ""}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, owner: e.target.value })
                    }
                    className={input + " w-32"}
                  />
                  <button
                    onClick={() => addAction(detail.id)}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-slate-800/60 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800/60 z-10">
              <h3 className="text-lg font-bold text-white">
                {modal.mode === "create"
                  ? "New 8D Report"
                  : `Edit ${modal.row?.reportNumber}`}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-2 rounded-lg hover:bg-slate-800/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Title" required>
                <input
                  required
                  className={input}
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Dimensional drift on part A-101"
                />
              </Field>
              <Field label="Problem Description">
                <textarea
                  rows={3}
                  className={input}
                  value={form.problemDescription || ""}
                  onChange={(e) =>
                    setForm({ ...form, problemDescription: e.target.value })
                  }
                  placeholder="What happened, where, impact"
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Severity">
                  <select
                    className={input}
                    value={form.severity || "MEDIUM"}
                    onChange={(e) =>
                      setForm({ ...form, severity: e.target.value })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </Field>
                <Field label="Linked NCR">
                  <select
                    className={input}
                    value={form.ncrId || ""}
                    onChange={(e) =>
                      setForm({ ...form, ncrId: e.target.value })
                    }
                  >
                    <option value="">— None —</option>
                    {ncrs.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.ncrNumber} · {n.status}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Product">
                <select
                  className={input}
                  value={form.productId || ""}
                  onChange={(e) =>
                    setForm({ ...form, productId: e.target.value })
                  }
                >
                  <option value="">— None —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
              </Field>

              {modal.mode === "edit" && (
                <>
                  <div className="border-t border-slate-700 pt-4 space-y-4">
                    <div className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                      Discipline fields
                    </div>
                    <Field label="D1 — Team Members">
                      <textarea
                        rows={2}
                        className={input}
                        value={form.teamMembers || ""}
                        onChange={(e) =>
                          setForm({ ...form, teamMembers: e.target.value })
                        }
                        placeholder="Cross-functional team"
                      />
                    </Field>
                    <Field label="D3 — Containment Action">
                      <textarea
                        rows={2}
                        className={input}
                        value={form.containmentAction || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            containmentAction: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Containment Owner">
                        <input
                          className={input}
                          value={form.containmentOwner || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              containmentOwner: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Containment Due">
                        <input
                          type="date"
                          className={input}
                          value={form.containmentDue || ""}
                          onChange={(e) =>
                            setForm({ ...form, containmentDue: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      D4 — 5-Why
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        className={input}
                        placeholder={`Why ${i}?`}
                        value={form[`why${i}`] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [`why${i}`]: e.target.value })
                        }
                      />
                    ))}
                    <Field label="Root Cause Summary">
                      <textarea
                        rows={2}
                        className={input}
                        value={form.rootCauseSummary || ""}
                        onChange={(e) =>
                          setForm({ ...form, rootCauseSummary: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="D5 — Corrective Action">
                      <textarea
                        rows={2}
                        className={input}
                        value={form.correctiveAction || ""}
                        onChange={(e) =>
                          setForm({ ...form, correctiveAction: e.target.value })
                        }
                      />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Corrective Owner">
                        <input
                          className={input}
                          value={form.correctiveOwner || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              correctiveOwner: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Corrective Due">
                        <input
                          type="date"
                          className={input}
                          value={form.correctiveDue || ""}
                          onChange={(e) =>
                            setForm({ ...form, correctiveDue: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="D6 — Preventive Action">
                      <textarea
                        rows={2}
                        className={input}
                        value={form.preventiveAction || ""}
                        onChange={(e) =>
                          setForm({ ...form, preventiveAction: e.target.value })
                        }
                      />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Preventive Owner">
                        <input
                          className={input}
                          value={form.preventiveOwner || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              preventiveOwner: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Preventive Due">
                        <input
                          type="date"
                          className={input}
                          value={form.preventiveDue || ""}
                          onChange={(e) =>
                            setForm({ ...form, preventiveDue: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="D7 — Verification Method">
                      <textarea
                        rows={2}
                        className={input}
                        value={form.verificationMethod || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            verificationMethod: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Verified By">
                      <input
                        className={input}
                        value={form.verifiedBy || ""}
                        onChange={(e) =>
                          setForm({ ...form, verifiedBy: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="D8 — Effectiveness Score (1-10)">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className={input}
                        value={form.effectivenessScore || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            effectivenessScore: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="D8 — Closure Summary">
                      <textarea
                        rows={2}
                        className={input}
                        value={form.closureSummary || ""}
                        onChange={(e) =>
                          setForm({ ...form, closureSummary: e.target.value })
                        }
                      />
                    </Field>
                  </div>
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
                  disabled={saving || !form.title}
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

function WhyTree({ report }: { report: any }) {
  const whys = [report.why1.why2.why3.why4.why5].filter(Boolean);
  if (whys.length === 0)
    return <p className="text-sm text-slate-400 italic">Not defined</p>;
  return (
    <div className="space-y-0">
      {whys.map((w, i) => (
        <div key={i} className="relative pl-8 pb-4 last:pb-0">
          {/* connector line */}
          {i < whys.length - 1 && (
            <span className="absolute left-[15px] top-6 bottom-0 w-px bg-blue-500/30" />
          )}
          <span className="absolute left-0 top-1 w-8 h-8 flex items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] font-black text-blue-500">
            {i + 1}
          </span>
          <div className="text-sm text-slate-600 text-slate-300 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/60 border-slate-600/40">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 mr-2">
              Why
            </span>
            {w}
          </div>
        </div>
      ))}
    </div>
  );
}

// 6-box Ishikawa (fishbone) — Man, Machine, Material, Method, Measurement, Environment
function Fishbone({ report: _report }: { report: any }) {
  const categories = [
    { key: "Man", cls: "border-rose-300 text-rose-500 bg-rose-500/5" },
    { key: "Machine", cls: "border-amber-300 text-amber-500 bg-amber-500/5" },
    {
      key: "Material",
      cls: "border-emerald-300 text-emerald-500 bg-emerald-500/5",
    },
    { key: "Method", cls: "border-blue-300 text-blue-500 bg-blue-500/5" },
    {
      key: "Measurement",
      cls: "border-purple-300 text-purple-500 bg-purple-500/5",
    },
    { key: "Environment", cls: "border-teal-300 text-teal-500 bg-teal-500/5" },
  ];
  return (
    <div className="mt-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
        Ishikawa / Fishbone — potential cause categories
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {categories.map((c) => (
          <div key={c.key} className={`p-2.5 rounded-lg border ${c.cls}`}>
            <div className="text-[10px] font-black uppercase tracking-wider">
              {c.key}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Investigate under this cause
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-600/60">
      <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-200">
        <span className="text-blue-500">{icon}</span>
        {title}
      </div>
      {children}
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
        title="8d"
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
