"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, HardHat, Plus, Undo2 } from "lucide-react";

export default function PpeClient() {
  const [issues, setIssues] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [byUser, setByUser] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalIssues: 0,
    itemsIssued: 0,
    activeItems: 0,
    employeesCovered: 0,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    category: "HELMET",
    itemName: "",
    quantity: "1",
    issuedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/ppe");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setIssues(d.issues || []);
      setUsers(d.users || []);
      setByUser(d.byUser || []);
      setStats(d.stats || {});
      setCategories(d.categories || []);
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
      const res = await fetch("/api/ppe", {
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
        <Loader2 className="w-8 h-8 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-lime-300 font-semibold">
            <HardHat className="w-4 h-4" /> M24 â€” PPE Issue Register
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Personal Protective Equipment
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every issue is tagged to the employee who received it; returned
            items close the record.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Issue PPE
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Issue records",
            value: stats.totalIssues,
            color: "text-white",
          },
          {
            label: "Items issued",
            value: stats.itemsIssued,
            color: "text-emerald-300",
          },
          {
            label: "Items active",
            value: stats.activeItems,
            color: "text-lime-300",
          },
          {
            label: "Employees covered",
            value: stats.employeesCovered,
            color: "text-sky-300",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
        <h2 className="text-sm font-semibold text-white mb-3">
          Issues per employee
        </h2>
        {byUser.length === 0 && (
          <div className="text-sm text-slate-400">No PPE issues on record.</div>
        )}
        <div className="flex flex-wrap gap-2">
          {byUser.map((u) => (
            <div
              key={u.name}
              className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-xs"
            >
              <span className="text-white font-semibold">{u.name}</span>
              <span className="text-slate-400">
                {" "}
                Â· {u.issues} items ({u.active} active)
              </span>
              <div className="text-lime-300/80 mt-0.5">
                {u.categories.join(", ")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-white">Issue register</h2>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Issue no.</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Item</th>
              <th className="p-3">Category</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Issued</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  No issues yet.
                </td>
              </tr>
            )}
            {issues.map((i) => (
              <tr
                key={i.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-300">{i.issueNumber}</td>
                <td className="p-3 text-white">{i.user?.name || "â€”"}</td>
                <td className="p-3 text-slate-200">{i.itemName}</td>
                <td className="p-3 text-slate-300">
                  {i.category.replace(/_/g, " ")}
                </td>
                <td className="p-3 text-slate-300">Ã—{i.quantity}</td>
                <td className="p-3 text-slate-300">
                  {new Date(i.issuedAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${i.returnedAt ? "bg-slate-700/40 text-slate-400" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}
                  >
                    {i.returnedAt ? "RETURNED" : "ACTIVE"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {!i.returnedAt && (
                    <button
                      onClick={() =>
                        api({ action: "return-issue", data: { id: i.id } })
                      }
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-xs text-slate-200 flex items-center gap-1 ml-auto"
                    >
                      <Undo2 className="w-3 h-3" /> Return
                    </button>
                  )}
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
            <h2 className="font-semibold text-white">Issue PPE</h2>
            <select
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            >
              <option value="">Select employeeâ€¦</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.employeeNumber ? ` (${u.employeeNumber})` : ""}
                </option>
              ))}
            </select>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              placeholder="Item (e.g. Casco helmet S2H3)"
              value={form.itemName}
              onChange={(e) => setForm({ ...form, itemName: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              type="number"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              type="date"
              value={form.issuedAt}
              onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({ action: "create-issue", data: form });
                  if (ok) {
                    setShow(false);
                    setForm({
                      userId: "",
                      category: "HELMET",
                      itemName: "",
                      quantity: "1",
                      issuedAt: new Date().toISOString().slice(0, 10),
                      notes: "",
                    });
                  }
                }}
                disabled={saving || !form.userId || !form.itemName}
                className="flex-1 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Issue
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
