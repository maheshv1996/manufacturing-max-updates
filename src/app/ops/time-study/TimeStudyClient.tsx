"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Pencil, Trash2, X, Timer } from "lucide-react";

type Study = any;

interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea";
  required?: boolean;
  placeholder?: string;
}

const FIELDS: Field[] = [
  {
    key: "operationName",
    label: "Operation Name",
    required: true,
    placeholder: "e.g. Face Milling - OP10",
  },
  {
    key: "productSku",
    label: "Product SKU",
    placeholder: "Leave blank for generic operation",
  },
  { key: "department", label: "Department" },
  {
    key: "standardTimeMin",
    label: "Standard Time (min / unit) — SAM",
    type: "number",
  },
  {
    key: "measuredTimeMin",
    label: "Measured Time (min / unit)",
    type: "number",
  },
  { key: "sampleSize", label: "Sample Size (pieces)", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined || isNaN(Number(v))
    ? "—"
    : Number(v).toFixed(2);

export default function TimeStudyClient() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ row: Study | null } | null>(null);
  const [form, setForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/time-study");
      if (res.ok) {
        const d = await res.json();
        setStudies(d.studies || []);
      }
    } catch (e) {
      logClientError(e, "TimeStudyClient");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (action: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/time-study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else await fetchData();
    } catch (e) {
      logClientError(e, "TimeStudyClient");
      alert("Action failed");
    } finally {
      setSaving(false);
    }
  };

  const openModal = (row: Study | null) => {
    const init: any = {};
    for (const f of FIELDS) {
      let v = row?.[f.key];
      if (f.type === "number") v = v ?? "";
      init[f.key] = v ?? "";
    }
    setForm(init);
    setModal({ row });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const payload: any = { ...form };
    if (modal.row) payload.id = modal.row.id;
    await api(modal.row ? "update" : "create", payload);
    setModal(null);
  };

  const del = async (row: Study) => {
    if (!confirm("Delete this time study?")) return;
    await api("delete", { id: row.id });
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm flex items-start gap-3">
        <div className="p-2.5 rounded-xl border bg-blue-500/10 text-blue-400 border-blue-500/30 shrink-0">
          <Timer className="w-5 h-5" />
        </div>
        <div className="text-sm text-slate-400">
          Standard Allowed Minutes (SAM) per operation. The{" "}
          <strong className="text-white">Actual</strong> column is computed live
          from shop-floor production logs for the product&apos;s work orders
          (last 90 days) — <strong className="text-white">variance</strong>{" "}
          compares actual vs standard (negative = ahead of standard).
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => openModal(null)}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New Time Study
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                {[
                  "Operation",
                  "Product",
                  "Dept",
                  "Standard (min)",
                  "Measured (min)",
                  "Actual from floor (min)",
                  "Variance %",
                  "Sample",
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
              {studies.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-10 text-center text-slate-400 italic"
                  >
                    No time studies yet.
                  </td>
                </tr>
              )}
              {studies.map((s) => {
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-5 py-3 font-bold text-white">
                      {s.operationName}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                      {s.productSku || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {s.department || "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-right font-black text-white">
                      {fmt(s.standardTimeMin)}
                    </td>
                    <td className="px-5 py-3 font-mono text-right">
                      {fmt(s.measuredTimeMin)}
                    </td>
                    <td className="px-5 py-3 font-mono text-right">
                      {fmt(s.actualAvgMin)}
                    </td>
                    <td className="px-5 py-3">
                      {s.variancePct == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            s.variancePct <= 0
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : s.variancePct <= 20
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {s.variancePct > 0 ? "+" : ""}
                          {s.variancePct}%
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {s.sampleSize || 0}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {modal.row ? "Edit" : "New"} Time Study
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
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    {f.label}
                    {f.required ? " *" : ""}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={form[f.key] ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, [f.key]: e.target.value })
                      }
                      rows={3}
                      className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    />
                  ) : (
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
                  )}
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
