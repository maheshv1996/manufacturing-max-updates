"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Biohazard, Plus, Truck, CheckCircle2 } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  GENERATED: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  IN_TRANSIT: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  DISPOSED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export default function HazWasteClient() {
  const [manifests, setManifests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    wasteType: "",
    category: "HAZARDOUS",
    quantityKg: "",
    transporter: "",
    destination: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/haz-waste");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setManifests(d.manifests || []);
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
      const res = await fetch("/api/haz-waste", {
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

  const nextLabel = (s: string) =>
    s === "GENERATED"
      ? "Dispatch"
      : s === "IN_TRANSIT"
        ? "Mark disposed"
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-lime-300 font-semibold">
            <Biohazard className="w-4 h-4" /> M25 — Hazardous Waste Manifests
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Waste Manifest Register (TSDF)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every generation, transit and disposal leg is tracked against the
            manifest number.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> New manifest
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Manifests", value: stats.total, color: "text-white" },
          { label: "Total (kg)", value: stats.totalKg, color: "text-sky-300" },
          {
            label: "Hazardous",
            value: stats.hazardous,
            color: "text-amber-300",
          },
          {
            label: "In transit",
            value: stats.inTransit,
            color: "text-sky-300",
          },
          {
            label: "Awaiting disposal",
            value: stats.awaitingDisposal,
            color: "text-red-400",
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

      {stats.byMonth?.length > 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            Waste by month (kg)
          </h2>
          <div className="flex items-end gap-2 h-24">
            {stats.byMonth.slice(0, 6).map(([m, kg]: [string, number]) => (
              <div
                key={m}
                className="flex flex-col items-center gap-1 flex-1 min-w-0"
              >
                <div className="text-[10px] text-slate-400">{kg}</div>
                <div
                  className="w-full rounded-t bg-lime-500/40"
                  style={{
                    height: `${Math.max(8, Math.min(100, (kg / Math.max(1, stats.byMonth[0][1])) * 100))}%`,
                  }}
                />
                <div className="text-[10px] text-slate-500">{m}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-white">
            Manifest register
          </h2>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Manifest</th>
              <th className="p-3">Date</th>
              <th className="p-3">Waste type</th>
              <th className="p-3">Category</th>
              <th className="p-3">Qty (kg)</th>
              <th className="p-3">Transporter</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {manifests.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-400">
                  No manifests yet.
                </td>
              </tr>
            )}
            {manifests.map((m) => (
              <tr
                key={m.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-300">{m.manifestNumber}</td>
                <td className="p-3 text-slate-300">
                  {new Date(m.date).toLocaleDateString()}
                </td>
                <td className="p-3 text-white">{m.wasteType}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${m.category === "HAZARDOUS" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-700/40 text-slate-300"}`}
                  >
                    {m.category.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-3 text-slate-300">{m.quantityKg}</td>
                <td className="p-3 text-slate-300">{m.transporter}</td>
                <td className="p-3 text-slate-300">{m.destination}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[m.status] || ""}`}
                  >
                    {m.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {nextLabel(m.status) && (
                    <button
                      onClick={() =>
                        api({ action: "advance-manifest", data: { id: m.id } })
                      }
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-xs text-slate-200 flex items-center gap-1 ml-auto"
                    >
                      {m.status === "GENERATED" ? (
                        <Truck className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}{" "}
                      {nextLabel(m.status)}
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
            <h2 className="font-semibold text-white">New manifest</h2>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              placeholder="Waste type (e.g. Used oil, E-waste, Empty paint drums)"
              value={form.wasteType}
              onChange={(e) => setForm({ ...form, wasteType: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            >
              <option value="HAZARDOUS">Hazardous</option>
              <option value="NON_HAZARDOUS">Non-hazardous</option>
            </select>
            <input
              type="number"
              placeholder="Quantity (kg)"
              value={form.quantityKg}
              onChange={(e) => setForm({ ...form, quantityKg: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              placeholder="Transporter (vehicle / agency)"
              value={form.transporter}
              onChange={(e) =>
                setForm({ ...form, transporter: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              placeholder="Destination (TSDF / recycler)"
              value={form.destination}
              onChange={(e) =>
                setForm({ ...form, destination: e.target.value })
              }
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
                  const ok = await api({
                    action: "create-manifest",
                    data: form,
                  });
                  if (ok) {
                    setShow(false);
                    setForm({
                      date: new Date().toISOString().slice(0, 10),
                      wasteType: "",
                      category: "HAZARDOUS",
                      quantityKg: "",
                      transporter: "",
                      destination: "",
                      notes: "",
                    });
                  }
                }}
                disabled={
                  saving ||
                  !form.wasteType ||
                  !form.transporter ||
                  !form.destination
                }
                className="flex-1 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create
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
