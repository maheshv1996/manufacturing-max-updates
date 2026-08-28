"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";

type Card = any;
type Supplier = { id: string; name: string };

const GRADE_BADGE: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  B: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  C: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  D: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
};

const gradeOf = (overall: number) =>
  overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : "D";
const fmt = (v: number) =>
  Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });

interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  options?: (string | { value: string; label: string })[];
  required?: boolean;
  placeholder?: string;
}

export default function SupplierScorecardsClient() {
  const [cards, setCards] = useState<Card[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ row: Card | null } | null>(null);
  const [form, setForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/supplier-scorecards");
      if (res.ok) {
        const d = await res.json();
        setCards(d.scorecards || []);
        setSuppliers(d.suppliers || []);
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

  const api = async (action: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/supplier-scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else await fetchData();
    } catch (e) {
      console.error(e);
      alert("Action failed");
    } finally {
      setSaving(false);
    }
  };

  const FIELDS: Field[] = [
    {
      key: "supplierName",
      label: "Supplier",
      type: "select",
      required: true,
      options: [
        { value: "", label: "Select supplier" },
        ...suppliers.map((s) => ({ value: s.name, label: s.name })),
      ],
    },
    {
      key: "period",
      label: "Period",
      required: true,
      placeholder: "e.g. Q1 FY27",
    },
    { key: "onTimeDelivery", label: "On-Time Delivery (%)", type: "number" },
    { key: "qualityPpm", label: "Quality PPM", type: "number" },
    {
      key: "costVariance",
      label: "Cost Variance (%)",
      type: "number",
      placeholder: "Positive = over cost",
    },
    { key: "responsiveness", label: "Responsiveness (1-5)", type: "number" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const openModal = (row: Card | null) => {
    const init: any = {};
    for (const f of FIELDS) {
      let v = row?.[f.key];
      if (f.type === "number") v = v ?? "";
      if (f.type === "select" && f.options && v === undefined) {
        const first = f.options[0];
        v = typeof first === "string" ? first : first.value;
      }
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

  const del = async (row: Card) => {
    if (!confirm("Delete this scorecard?")) return;
    await api("delete", { id: row.id });
  };

  const avgOverall = cards.length
    ? cards.reduce((s, c) => s + (c.overallScore || 0), 0) / cards.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Scorecards
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {cards.length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Avg Overall
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {avgOverall.toFixed(1)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Grade A / B
          </div>
          <div className="text-2xl font-black font-mono text-blue-400">
            {cards.filter((c) => c.grade === "A" || c.grade === "B").length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Grade D (risk)
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {cards.filter((c) => c.grade === "D").length}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => openModal(null)}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New Scorecard
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
                  "Supplier",
                  "Period",
                  "OTD %",
                  "Quality PPM",
                  "Cost Var %",
                  "Responsiveness",
                  "Overall",
                  "Grade",
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
              {cards.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-10 text-center text-slate-400 italic"
                  >
                    No scorecards yet.
                  </td>
                </tr>
              )}
              {cards.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-800/90/20 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="font-bold text-white">{c.supplierName}</div>
                    {c.supplierId && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        #{c.supplierId.slice(0, 8)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                    {c.period}
                  </td>
                  <td className="px-5 py-3 font-mono text-right">
                    {fmt(c.onTimeDelivery)}%
                  </td>
                  <td className="px-5 py-3 font-mono text-right">
                    {fmt(c.qualityPpm)}
                  </td>
                  <td
                    className={`px-5 py-3 font-mono text-right ${c.costVariance > 0 ? "text-rose-500" : "text-emerald-400"}`}
                  >
                    {c.costVariance > 0 ? "+" : ""}
                    {fmt(c.costVariance)}%
                  </td>
                  <td className="px-5 py-3 font-mono text-right">
                    {c.responsiveness}/5
                  </td>
                  <td className="px-5 py-3 font-mono font-black text-right text-white">
                    {fmt(c.overallScore)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${GRADE_BADGE[c.grade] || GRADE_BADGE.C}`}
                    >
                      {c.grade || gradeOf(c.overallScore)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(c)}
                        className="px-2.5 py-1.5 bg-slate-800/60 text-blue-400 rounded-lg text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5 inline mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => del(c)}
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
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {modal.row ? "Edit" : "New"} Scorecard
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
              {FIELDS.map((f) => {
                const cls =
                  "w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white";
                return (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      {f.label}
                      {f.required ? " *" : ""}
                    </label>
                    {f.type === "select" ? (
                      <select
                        required={f.required}
                        value={form[f.key] ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                        className={cls}
                      >
                        {(f.options || []).map((o) => {
                          const val = typeof o === "string" ? o : o.value;
                          const lab = typeof o === "string" ? o : o.label;
                          return (
                            <option key={val} value={val}>
                              {lab}
                            </option>
                          );
                        })}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        value={form[f.key] ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                        rows={3}
                        className={cls}
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
                        className={cls}
                      />
                    )}
                  </div>
                );
              })}
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
