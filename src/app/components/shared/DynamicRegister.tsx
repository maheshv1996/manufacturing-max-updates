"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Printer,
} from "lucide-react";

export interface RegisterField {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface RegisterColumn {
  key: string;
  label: string;
  format?: "text" | "date" | "number" | "currency" | "boolean";
}

export interface RegisterConfig {
  title: string;
  description?: string;
  entity: string;
  icon?: any;
  accent?: string; // tailwind classes for the header icon
  fields: RegisterField[];
  columns: RegisterColumn[];
  statusKey?: string;
  statusColors?: Record<string, string>;
  searchKeys?: string[];
}

function formatValue(col: RegisterColumn, row: any): string {
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return "—";
  if (col.format === "date") return new Date(v).toLocaleDateString();
  if (col.format === "number") return Number(v).toLocaleString();
  if (col.format === "currency") {
    return `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} ₹`;
  }
  if (col.format === "boolean") return v ? "Yes" : "No";
  return String(v);
}

const STATUS_COLOR_DEFAULTS: Record<string, string> = {
  COMPLIANT: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  PARTIAL: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  NON_COMPLIANT: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  FIT: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  FIT_WITH_NOTES: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  UNFIT: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  BOOKED: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  IN_TRANSIT: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  CLEARED: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
  DELIVERED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  OPERATIONAL:
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  DEGRADED: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  OFFLINE: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  SUCCESS: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  FAILED: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  RUNNING: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  CLOSED: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  DRAFT: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
};

export default function DynamicRegister({
  config,
}: {
  config: RegisterConfig;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [query, setQuery] = useState("");

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch(`/api/register/${config.entity}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.rows || []);
      }
    } catch (e) {
      logClientError(e, "DynamicRegister");
    } finally {
      setLoading(false);
    }
  }, [config.entity]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    const init: Record<string, any> = {};
    for (const f of config.fields) {
      if (f.type === "select" && f.options && f.options.length > 0) {
        init[f.key] = f.options[0];
      } else if (f.type === "number") {
        init[f.key] = "";
      } else if (f.type === "date") {
        init[f.key] = new Date().toISOString().slice(0, 10);
      } else {
        init[f.key] = "";
      }
    }
    setForm(init);
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: any) => {
    const init: Record<string, any> = {};
    for (const f of config.fields) {
      let v = row[f.key];
      if (f.type === "date" && v) {
        v = new Date(v).toISOString().slice(0, 10);
      }
      init[f.key] = v ?? "";
    }
    setForm(init);
    setEditing(row);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (editing) payload.id = editing.id;
      const res = await fetch(`/api/register/${config.entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editing ? "update" : "create",
          data: payload,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || "Save failed");
      } else {
        setModalOpen(false);
        await fetchRows();
      }
    } catch (err) {
      logClientError(err, "DynamicRegister");
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: any) => {
    if (!confirm(`Delete this record? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/register/${config.entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", data: { id: row.id } }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || "Delete failed");
      } else {
        await fetchRows();
      }
    } catch (err) {
      logClientError(err, "DynamicRegister");
      alert("Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const filtered = query.trim()
    ? rows.filter((r) =>
        (config.searchKeys || []).some((k) =>
          String(r[k] ?? "")
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      )
    : rows;

  const Icon = config.icon;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className={`p-2.5 rounded-xl border ${config.accent || "bg-blue-500/10 text-blue-400 border-blue-500/30"}`}
            >
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-white">{config.title}</h2>
            {config.description && (
              <p className="text-sm text-slate-400">{config.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            title="Print / Save as PDF"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden md:inline">Print / PDF</span>
          </button>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-48 bg-slate-800/60 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={openCreate}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Record
          </button>
        </div>
      </div>

      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto print:shadow-none print:border print:border-gray-300 print:rounded-none print:overflow-visible">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700 print:bg-gray-100">
              <tr>
                {config.columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-5 py-3.5 font-semibold text-slate-200 capitalize"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-5 py-3.5 font-semibold text-slate-200 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={config.columns.length + 1}
                    className="px-5 py-10 text-center text-slate-400 italic"
                  >
                    No records found.
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-800/90/20 transition-colors"
                >
                  {config.columns.map((col) => (
                    <td key={col.key} className="px-5 py-3 text-slate-300">
                      {config.statusKey === col.key ? (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            (config.statusColors || STATUS_COLOR_DEFAULTS)[
                              String(row[col.key])
                            ] ||
                            "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                          }`}
                        >
                          {formatValue(col, row)}
                        </span>
                      ) : (
                        formatValue(col, row)
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-blue-400 rounded-lg border border-slate-600 text-xs font-bold transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 hover:bg-rose-900/40 text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800 text-xs font-bold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {editing ? "Edit Record" : `New ${config.title}`}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleSave}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {config.fields.map((f) => (
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
                      className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    >
                      {(f.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
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
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
