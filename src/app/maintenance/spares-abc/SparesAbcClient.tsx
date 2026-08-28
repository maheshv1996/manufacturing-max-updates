"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Boxes, Plus, Wand2, Wrench } from "lucide-react";

const ABC_STYLE: Record<string, string> = {
  A: "bg-red-500/20 text-red-300 border-red-500/40",
  B: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  C: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};
const VED_STYLE: Record<string, string> = {
  V: "bg-red-500/20 text-red-300 border-red-500/40",
  E: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  D: "bg-slate-600/40 text-slate-300",
};

export default function SparesAbcClient() {
  const [spares, setSpares] = useState<any[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [pmRules, setPmRules] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    machineCode: "",
    currentQty: "",
    minQty: "",
    unitCost: "",
    supplierName: "",
    leadTimeDays: "15",
    avgDailyUsage: "0",
    abcClass: "",
    vedClass: "E",
  });
  const [kitForm, setKitForm] = useState({
    name: "",
    description: "",
    items: [] as any[],
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/spares");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setSpares(d.spares || []);
      setKits(d.kits || []);
      setPmRules(d.pmRules || []);
      setStats(d.stats || {});
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
      const res = await fetch("/api/spares", {
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

  const editSpare = (s: any) => {
    const cls = window.prompt(
      `Set ABC class for ${s.name} (A/B/C, empty = auto):`,
      s.abcClass || "",
    );
    if (cls !== null)
      api({
        action: "update-spare",
        data: { id: s.id, abcClass: cls.toUpperCase() },
      });
  };
  const editVed = (s: any) => {
    const v = window.prompt(
      `Set VED class for ${s.name} (V/E/D):`,
      s.vedClass || "E",
    );
    if (v !== null)
      api({
        action: "update-spare",
        data: { id: s.id, vedClass: v.toUpperCase() },
      });
  };
  const editLead = (s: any) => {
    const d = window.prompt(
      `Lead time (days) for ${s.name}:`,
      String(s.leadTimeDays),
    );
    if (d !== null && d !== "")
      api({
        action: "update-spare",
        data: { id: s.id, leadTimeDays: parseInt(d, 10) },
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
            <Boxes className="w-4 h-4" /> M27 — Spares ABC/VED
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Spare Parts Classification & Reorder
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Reorder point = lead time × avg daily usage. ABC auto-classifies on
            annual usage value (Pareto 70/90); VED is set manually. Kit lists
            auto-attach to PM jobs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => api({ action: "auto-classify", data: {} })}
            className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition"
          >
            <Wand2 className="w-4 h-4" /> Auto-classify ABC
          </button>
          <button
            onClick={() => setShowKit(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition"
          >
            <Wrench className="w-4 h-4" /> New kit
          </button>
          <button
            onClick={() => setShow(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
          >
            <Plus className="w-4 h-4" /> Add spare
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "ABC A", value: stats.a, color: "text-red-300" },
          { label: "ABC B", value: stats.b, color: "text-amber-300" },
          { label: "ABC C", value: stats.c, color: "text-emerald-300" },
          { label: "Vital", value: stats.vital, color: "text-red-300" },
          {
            label: "Essential",
            value: stats.essential,
            color: "text-amber-300",
          },
          {
            label: "Below reorder",
            value: stats.belowReorder,
            color: stats.belowReorder ? "text-red-400" : "text-emerald-300",
          },
          {
            label: "Unclassified",
            value: stats.unclassified,
            color: "text-slate-300",
          },
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
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-white">
            Spare parts register
          </h2>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">SKU / Name</th>
              <th className="p-3">ABC</th>
              <th className="p-3">VED</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Lead</th>
              <th className="p-3">Daily use</th>
              <th className="p-3">Reorder pt</th>
              <th className="p-3">Annual ₹</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {spares.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-400">
                  No spares yet.
                </td>
              </tr>
            )}
            {spares.map((s) => (
              <tr
                key={s.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3">
                  <div className="text-white font-medium">{s.name}</div>
                  <div className="text-xs text-slate-400">
                    {s.sku}
                    {s.location ? ` · ${s.location}` : ""}
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${ABC_STYLE[s.abcClass] || ""}`}
                  >
                    {s.abcClass || "—"}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${VED_STYLE[s.vedClass] || ""}`}
                  >
                    {s.vedClass || "—"}
                  </span>
                </td>
                <td className="p-3 text-slate-200">{s.currentQty}</td>
                <td className="p-3 text-slate-300">{s.leadTimeDays}d</td>
                <td className="p-3 text-slate-300">{s.avgDailyUsage}</td>
                <td className="p-3 text-slate-200 font-semibold">
                  {s.reorderPoint || s.minQty}
                </td>
                <td className="p-3 text-slate-300">
                  ₹{Math.round(s.annualValue).toLocaleString("en-IN")}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${s.belowReorder ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}
                  >
                    {s.belowReorder ? "REORDER" : "OK"}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => editSpare(s)}
                    className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px] text-slate-200"
                  >
                    ABC
                  </button>{" "}
                  <button
                    onClick={() => editVed(s)}
                    className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px] text-slate-200"
                  >
                    VED
                  </button>{" "}
                  <button
                    onClick={() => editLead(s)}
                    className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px] text-slate-200"
                  >
                    Lead
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {kits.map((k) => (
          <div
            key={k.id}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-300" /> {k.name}
              </div>
              <span className="text-xs text-slate-400">
                {k.items.length} spare(s)
              </span>
            </div>
            {k.description && (
              <div className="text-xs text-slate-500 mt-1">{k.description}</div>
            )}
            <div className="mt-2 space-y-1">
              {k.items.map((i: any) => (
                <div
                  key={i.id}
                  className="flex justify-between text-xs text-slate-300 bg-slate-900/50 rounded-lg px-2.5 py-1.5"
                >
                  <span>{i.spare?.name || "—"}</span>
                  <span className="text-slate-400">×{i.quantity}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs">
              <span className="text-slate-400">Attach to PM rule: </span>
              <select
                onChange={(e) => {
                  if (e.target.value)
                    api({
                      action: "set-pm-kit",
                      data: { pmRuleId: e.target.value, kitId: k.id },
                    });
                }}
                defaultValue=""
                className="rounded-lg bg-slate-900/60 border border-slate-700 px-2 py-1 text-xs text-white"
              >
                <option value="">— select machine rule —</option>
                {pmRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.machine?.name} · {r.title}
                    {r.kitId ? " (kit set)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {kits.length === 0 && (
          <div className="md:col-span-2 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
            No kits yet — kits auto-attach to PM jobs when the rule is
            completed.
          </div>
        )}
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
            <h2 className="font-semibold text-white">Add spare</h2>
            <div className="flex gap-2">
              <input
                placeholder="SKU"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-1/3 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-2/3 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <input
              placeholder="Machine code (optional)"
              value={form.machineCode}
              onChange={(e) =>
                setForm({ ...form, machineCode: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Current qty"
                value={form.currentQty}
                onChange={(e) =>
                  setForm({ ...form, currentQty: e.target.value })
                }
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                placeholder="Min qty"
                value={form.minQty}
                onChange={(e) => setForm({ ...form, minQty: e.target.value })}
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                placeholder="Unit cost ₹"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <input
                placeholder="Supplier"
                value={form.supplierName}
                onChange={(e) =>
                  setForm({ ...form, supplierName: e.target.value })
                }
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                placeholder="Lead time (days)"
                value={form.leadTimeDays}
                onChange={(e) =>
                  setForm({ ...form, leadTimeDays: e.target.value })
                }
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                placeholder="Avg daily usage"
                value={form.avgDailyUsage}
                onChange={(e) =>
                  setForm({ ...form, avgDailyUsage: e.target.value })
                }
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({ action: "create-spare", data: form });
                  if (ok) setShow(false);
                }}
                disabled={saving || !form.sku || !form.name}
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

      {showKit && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowKit(false)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">New spare kit</h2>
            <input
              placeholder="Kit name (e.g. CNC spindle PM kit)"
              value={kitForm.name}
              onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
            <input
              placeholder="Description (optional)"
              value={kitForm.description}
              onChange={(e) =>
                setKitForm({ ...kitForm, description: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
            <div className="space-y-2">
              {kitForm.items.map((it: any, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={it.spareId}
                    onChange={(e) => {
                      const items = [...kitForm.items];
                      items[idx] = { ...items[idx], spareId: e.target.value };
                      setKitForm({ ...kitForm, items });
                    }}
                    className="flex-1 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select spare…</option>
                    {spares.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) => {
                      const items = [...kitForm.items];
                      items[idx] = { ...items[idx], quantity: e.target.value };
                      setKitForm({ ...kitForm, items });
                    }}
                    className="w-20 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                  <button
                    onClick={() =>
                      setKitForm({
                        ...kitForm,
                        items: kitForm.items.filter(
                          (_: any, i: number) => i !== idx,
                        ),
                      })
                    }
                    className="rounded-xl bg-slate-700 px-3 text-sm text-slate-300"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setKitForm({
                    ...kitForm,
                    items: [...kitForm.items, { spareId: "", quantity: "1" }],
                  })
                }
                className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs text-slate-200"
              >
                + Add item
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({ action: "create-kit", data: kitForm });
                  if (ok) {
                    setShowKit(false);
                    setKitForm({ name: "", description: "", items: [] });
                  }
                }}
                disabled={saving || !kitForm.name}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create kit
              </button>
              <button
                onClick={() => setShowKit(false)}
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
