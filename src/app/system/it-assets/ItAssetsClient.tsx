"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Monitor, Plus } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  IN_STOCK: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  ASSIGNED: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  IN_MAINTENANCE: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  RETIRED: "bg-slate-600/40 text-slate-300",
};

export default function ItAssetsClient() {
  const [assets, setAssets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    assetType: "LAPTOP",
    serialNumber: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/it-assets");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setAssets(d.assets || []);
      setUsers(d.users || []);
      setStats(d.stats || {});
      setTypes(d.types || []);
    } catch {
      setToast("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (body: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/it-assets", {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
            <Monitor className="w-4 h-4" /> M31 — IT Asset Register
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Assets & Assignments
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Register, assign to employees, and track status of every IT asset
            (ITA auto-numbered).
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Add asset
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Assigned", value: stats.assigned, color: "text-sky-300" },
          {
            label: "In stock",
            value: stats.inStock,
            color: "text-emerald-300",
          },
          {
            label: "In maintenance",
            value: stats.inMaintenance,
            color: "text-amber-300",
          },
          { label: "Retired", value: stats.retired, color: "text-slate-300" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-3"
          >
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Serial</th>
              <th className="p-3">Status</th>
              <th className="p-3">Assigned to</th>
              <th className="p-3">Notes</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  No assets yet.
                </td>
              </tr>
            )}
            {assets.map((a) => (
              <tr
                key={a.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-300">{a.assetCode}</td>
                <td className="p-3 font-medium text-white">{a.name}</td>
                <td className="p-3 text-slate-300">{a.assetType}</td>
                <td className="p-3 text-slate-400">{a.serialNumber || "—"}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[a.status] || ""}`}
                  >
                    {a.status.replace("_", " ")}
                  </span>
                </td>
                <td className="p-3">
                  <select
                    value={a.assignedToId || ""}
                    onChange={(e) =>
                      api({
                        action: "update-asset",
                        data: {
                          id: a.id,
                          assignedToId: e.target.value || null,
                        },
                      })
                    }
                    className="rounded-lg bg-slate-900/60 border border-slate-700 px-2 py-1 text-xs text-white"
                  >
                    <option value="">— unassigned —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-slate-500 max-w-[160px] truncate">
                  {a.notes || "—"}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <select
                    value={a.status}
                    onChange={(e) =>
                      api({
                        action: "update-asset",
                        data: { id: a.id, status: e.target.value },
                      })
                    }
                    className="rounded-lg bg-slate-900/60 border border-slate-700 px-2 py-1 text-xs text-white"
                  >
                    {Object.keys(STATUS_COLOR).map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShow(false)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">Add asset</h2>
            <div className="flex gap-2">
              <select
                value={form.assetType}
                onChange={(e) =>
                  setForm({ ...form, assetType: e.target.value })
                }
                className="w-1/3 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                placeholder="Name (e.g. Dell Latitude 5440 #3)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-2/3 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <input
              placeholder="Serial number"
              value={form.serialNumber}
              onChange={(e) =>
                setForm({ ...form, serialNumber: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({ action: "create-asset", data: form });
                  if (ok) {
                    setShow(false);
                    setForm({
                      name: "",
                      assetType: "LAPTOP",
                      serialNumber: "",
                      notes: "",
                    });
                  }
                }}
                disabled={saving || !form.name}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => setShow(false)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-slate-800 border border-slate-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
