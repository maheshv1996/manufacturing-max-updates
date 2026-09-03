"use client";

import PageHeader from "@/app/components/shared/PageHeader";


import {logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  X,
  Target,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  ShieldCheck
} from "lucide-react";

const KPI_META: Record<
  string,
  { label: string; unit: string; higherIsBetter: boolean }
> = {
  OTD_PCT: { label: "On-Time Delivery %", unit: "%", higherIsBetter: true },
  PPM: { label: "Defects per Million", unit: "ppm", higherIsBetter: false },
  MTBF: {
    label: "Mean Time Between Failures",
    unit: "h",
    higherIsBetter: true,
  },
  TRAINING_PCT: {
    label: "Operator Training %",
    unit: "%",
    higherIsBetter: true,
  },
};

export default function ObjectivesClient() {
  const [objectives, setObjectives] = useState<any[]>([]);
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    row?: any;
  } | null>(null);
  const [form, setForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      const [r, me] = await Promise.all([
        fetch(`/api/quality-objectives?period=${period}`),
        fetch("/api/auth/me"),
      ]);
      if (r.ok) {
        const d = await r.json();
        setObjectives(d.objectives || []);
        setPeriod(d.period || "");
      }
      if (me.ok) {
        const m = await me.json();
        setIsManager(m.user?.level === "MANAGER" || m.user?.isOwner === true);
      }
    } catch (e) {
      logClientError(e, "ObjectivesClient");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (body: any): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/quality-objectives", {
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

  const openCreate = () => {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setForm({
      department: "production",
      kpiType: "OTD_PCT",
      targetValue: "",
      period: cur,
      ownerName: "",
      isActive: true,
    });
    setModal({ mode: "create" });
  };

  const save = async () => {
    if (modal?.mode === "create") {
      await api({ action: "create", data: form });
    } else if (modal?.mode === "edit" && modal.row) {
      const { actual, met, detail, createdAt, updatedAt, ...rest } = form;
      await api({ action: "update", data: { id: modal.row.id, ...rest } });
    }
    setModal(null);
  };

  const remove = async (row: any) => {
    if (
      !window.confirm(
        `Delete ${row.department} ${KPI_META[row.kpiType]?.label} target for ${row.period}?`,
      )
    )
      return;
    await api({ action: "delete", data: { id: row.id } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const metCount = objectives.filter((o) => o.met === true).length;
  const missCount = objectives.filter((o) => o.met === false).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <Target className="w-4 h-4" /> ISO 9001 · cl.6.2 / cl.9.1
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Quality Objectives
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Per-department KPI targets — actuals computed live from app records,
            never entered by hand.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
          >
            <option value="">All periods</option>
            {[...new Set(objectives.map((o) => o.period))]
              .sort()
              .reverse()
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>
          {isManager && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 px-4 py-2 text-sm font-medium hover:bg-indigo-500/30 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Target
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-white">
            {objectives.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Active targets</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-emerald-300">{metCount}</div>
          <div className="text-xs text-slate-400 mt-1">Met</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div
            className={`text-2xl font-bold ${missCount ? "text-rose-300" : "text-white"}`}
          >
            {missCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">Missed</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">KPI</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Actual (live)</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Owner</th>
                {isManager && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {objectives.map((o) => {
                const meta = KPI_META[o.kpiType] || {
                  label: o.kpiType,
                  unit: "",
                  higherIsBetter: true,
                };
                return (
                  <tr
                    key={o.id}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-white capitalize">
                      {o.department}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{meta.label}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">
                      {o.targetValue}
                      {meta.unit}
                    </td>
                    <td className="px-4 py-3">
                      {o.actual === null ? (
                        <span className="text-slate-500 text-xs">
                          {o.detail}
                        </span>
                      ) : (
                        <span className="text-slate-100 font-semibold">
                          {o.actual}
                          {meta.unit}
                          <span className="text-slate-500 font-normal text-xs ml-1.5">
                            {o.detail}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {o.met === true && (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 px-2 py-1">
                          <CheckCircle2 className="w-3 h-3" /> Met
                        </span>
                      )}
                      {o.met === false && (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/40 px-2 py-1">
                          <AlertTriangle className="w-3 h-3" /> Missed
                        </span>
                      )}
                      {o.met === null && (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30 px-2 py-1">
                          <MinusCircle className="w-3 h-3" /> No data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{o.period}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {o.ownerName || "—"}
                    </td>
                    {isManager && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
      <PageHeader
        title="Objectives"
        description="Inspections, NCRs, audits and compliance control."
        icon={<ShieldCheck className="w-6 h-6" />}
        iconTone="emerald"
      />

                          <button
                            onClick={() => {
                              setForm({ ...o });
                              setModal({ mode: "edit", row: o });
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => remove(o)}
                            className="text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {objectives.length === 0 && (
                <tr>
                  <td
                    colSpan={isManager ? 8 : 7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No quality objectives defined.{" "}
                    {isManager && "Set your first KPI target."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Actuals auto-compute: OTD% from dispatch/completion vs promised dates ·
        PPM from scrap vs produced · MTBF from run hours vs breakdown events ·
        Training % from active operator certifications. Missed targets surface
        as digest flags and feed the MRM agenda.
      </p>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/60 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {modal.mode === "create" ? "New Quality Target" : "Edit Target"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Department</label>
                <input
                  value={form.department || ""}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
                  placeholder="production"
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Period (YYYY-MM)
                </label>
                <input
                  value={form.period || ""}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="2026-08"
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">KPI</label>
              <select
                value={form.kpiType || "OTD_PCT"}
                onChange={(e) => setForm({ ...form, kpiType: e.target.value })}
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {Object.entries(KPI_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Target value</label>
                <input
                  type="number"
                  step="any"
                  value={form.targetValue ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, targetValue: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Owner</label>
                <input
                  value={form.ownerName || ""}
                  onChange={(e) =>
                    setForm({ ...form, ownerName: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.isActive !== false}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="accent-indigo-500"
              />
              Active target
            </label>
            <button
              onClick={save}
              disabled={
                saving ||
                !form.department ||
                !form.kpiType ||
                form.targetValue === "" ||
                !form.period
              }
              className="w-full rounded-xl bg-indigo-500 text-white text-sm font-semibold py-2.5 hover:bg-indigo-400 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Save Target"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-800 border border-slate-600/60 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5 inline" />
          </button>
        </div>
      )}
    </div>
  );
}
