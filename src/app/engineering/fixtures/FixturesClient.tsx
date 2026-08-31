"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, Wrench, Pencil, Trash2 } from "lucide-react";

const STATUS_CLS: Record<string, string> = {
  AVAILABLE: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  UNDER_MAINT: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  MISSING: "bg-rose-500/10 text-rose-300 border border-rose-500/40",
};

export default function FixturesClient() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    row?: any;
  } | null>(null);
  const [form, setForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/fixtures");
      if (res.ok) {
        const d = await res.json();
        setFixtures(d.fixtures || []);
        setProducts(d.products || []);
        setMachines(d.machines || []);
      }
    } catch (e) {
      logClientError(e, "FixturesClient");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (body: any): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/fixtures", {
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

  const save = async () => {
    if (modal?.mode === "create") await api({ action: "create", data: form });
    else if (modal?.mode === "edit" && modal.row) {
      const { id, product, machine, ...rest } = form;
      await api({ action: "update", data: { id, ...rest } });
    }
    setModal(null);
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Delete fixture ${row.code} — ${row.name}?`)) return;
    await api({ action: "delete", data: { id: row.id } });
  };

  const setStatus = async (row: any, status: string) => {
    await api({ action: "update", data: { id: row.id, status } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const counts = {
    AVAILABLE: fixtures.filter((f) => f.status === "AVAILABLE").length,
    UNDER_MAINT: fixtures.filter((f) => f.status === "UNDER_MAINT").length,
    MISSING: fixtures.filter((f) => f.status === "MISSING").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <Wrench className="w-4 h-4" /> Engineering ↔ Production ↔
            Maintenance
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Tooling & Fixture Register
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            A Work Order cannot start while its fixture is UNDER_MAINT or
            MISSING — managers can override with a reason.
          </p>
        </div>
        <button
          onClick={() => {
            setForm({
              code: "",
              name: "",
              productId: "",
              machineId: "",
              status: "AVAILABLE",
              location: "",
              procurementCost: "",
              notes: "",
            });
            setModal({ mode: "create" });
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 px-4 py-2 text-sm font-medium hover:bg-indigo-500/30 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Fixture
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-emerald-300">
            {counts.AVAILABLE}
          </div>
          <div className="text-xs text-slate-400 mt-1">Available</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div
            className={`text-2xl font-bold ${counts.UNDER_MAINT ? "text-amber-300" : "text-white"}`}
          >
            {counts.UNDER_MAINT}
          </div>
          <div className="text-xs text-slate-400 mt-1">Under Maintenance</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div
            className={`text-2xl font-bold ${counts.MISSING ? "text-rose-300" : "text-white"}`}
          >
            {counts.MISSING}
          </div>
          <div className="text-xs text-slate-400 mt-1">Missing</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Tooling Cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-slate-200">
                    {f.code}
                  </td>
                  <td className="px-4 py-3 text-white">{f.name}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {f.product ? `${f.product.sku}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {f.machine ? f.machine.code : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={f.status}
                      onChange={(e) => setStatus(f, e.target.value)}
                      className={`rounded-full text-xs px-2.5 py-1 font-semibold ${STATUS_CLS[f.status] || STATUS_CLS.AVAILABLE} bg-transparent`}
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="UNDER_MAINT">UNDER_MAINT</option>
                      <option value="MISSING">MISSING</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {f.location || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    ₹{Number(f.procurementCost || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setForm({ ...f });
                          setModal({ mode: "edit", row: f });
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(f)}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {fixtures.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No fixtures registered. Add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                {modal.mode === "create" ? "New Fixture" : "Edit Fixture"}
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
                <label className="text-xs text-slate-400">Code *</label>
                <input
                  value={form.code || ""}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="FIX-001"
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Name *</label>
                <input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Housing Milling Fixture"
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">
                  Product (WO gate)
                </label>
                <select
                  value={form.productId || ""}
                  onChange={(e) =>
                    setForm({ ...form, productId: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">— none —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Machine</label>
                <select
                  value={form.machineId || ""}
                  onChange={(e) =>
                    setForm({ ...form, machineId: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">— none —</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Status</label>
                <select
                  value={form.status || "AVAILABLE"}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                >
                  <option>AVAILABLE</option>
                  <option>UNDER_MAINT</option>
                  <option>MISSING</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Location</label>
                <input
                  value={form.location || ""}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="Tool Room Rack B3"
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Tooling cost ₹ (feeds sales estimation sheet)
              </label>
              <input
                type="number"
                value={form.procurementCost ?? ""}
                onChange={(e) =>
                  setForm({ ...form, procurementCost: e.target.value })
                }
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Notes</label>
              <textarea
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={save}
              disabled={saving || !form.code || !form.name}
              className="w-full rounded-xl bg-indigo-500 text-white text-sm font-semibold py-2.5 hover:bg-indigo-400 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Save Fixture"
              )}
            </button>
          </div>
        </div>
      )}

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
