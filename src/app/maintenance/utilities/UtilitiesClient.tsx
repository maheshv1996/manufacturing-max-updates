"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Zap, Plus } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  POWER: "Power",
  COMPRESSED_AIR: "Compressed Air",
  HVAC: "HVAC",
  WATER: "Water",
  GAS: "Gas",
};
const TYPE_COLOR: Record<string, string> = {
  POWER: "text-amber-300",
  COMPRESSED_AIR: "text-sky-300",
  HVAC: "text-orange-300",
  WATER: "text-blue-300",
  GAS: "text-red-300",
};

export default function UtilitiesClient() {
  const [kpis, setKpis] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    utilityType: "POWER",
    meterName: "",
    reading: "",
    unit: "kWh",
    cost: "",
    readAt: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/utilities?month=${month}`);
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setKpis(d.kpis || []);
      setTrend(d.trend || []);
      setReadings(d.readings || []);
      setTypes(d.types || []);
    } catch {
      setToast("Network error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const api = async (body: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/utilities", {
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

  const maxReading = Math.max(
    1,
    ...trend.flatMap((t) => t.points.map((p: any) => p.reading)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
            <Zap className="w-4 h-4" /> M28 — Utilities Log
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Daily Utilities & Energy KPIs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Daily meter readings per utility; month KPIs vs prior month and a
            35-day trend.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => setShow(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
          >
            <Plus className="w-4 h-4" /> Log reading
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div
            key={k.type}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div
              className={`text-xs font-semibold uppercase tracking-wider ${TYPE_COLOR[k.type]}`}
            >
              {TYPE_LABEL[k.type] || k.type}
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {k.reading.toLocaleString("en-IN")}
              <span className="text-sm text-slate-400 font-normal">
                {" "}
                {k.type === "POWER"
                  ? "kWh"
                  : k.type === "COMPRESSED_AIR"
                    ? "h"
                    : "unit"}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>₹{k.cost.toLocaleString("en-IN")}</span>
              <span>{k.daysLogged} days logged</span>
            </div>
            <div
              className={`text-xs mt-1 font-semibold ${k.deltaPct === null ? "text-slate-500" : k.deltaPct > 0 ? "text-red-300" : "text-emerald-300"}`}
            >
              {k.deltaPct === null
                ? "vs prev month: —"
                : `vs prev month: ${k.deltaPct > 0 ? "+" : ""}${k.deltaPct}%`}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
        <h2 className="text-sm font-semibold text-white mb-3">35-day trend</h2>
        {trend.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8">
            No readings in the last 35 days.
          </div>
        )}
        <div className="flex items-end gap-1 h-40">
          {trend.map((t) => (
            <div key={t.type} className="flex-1 flex flex-col gap-1">
              {t.points.map((p: any, i: number) => (
                <div
                  key={i}
                  title={`${p.day} · ${p.reading}`}
                  className="rounded-sm bg-amber-500/40 hover:bg-amber-400/60 transition"
                  style={{
                    height: `${Math.max(2, (p.reading / maxReading) * 100)}%`,
                  }}
                />
              ))}
              <div
                className={`text-center text-[10px] ${TYPE_COLOR[t.type]} truncate`}
              >
                {TYPE_LABEL[t.type]?.split(" ")[0]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-white">
            Readings — {month}
          </h2>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Date</th>
              <th className="p-3">Utility</th>
              <th className="p-3">Meter</th>
              <th className="p-3">Reading</th>
              <th className="p-3">Cost ₹</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No readings logged for this month.
                </td>
              </tr>
            )}
            {readings.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-200">
                  {new Date(r.readAt).toLocaleDateString("en-IN")}
                </td>
                <td className="p-3">
                  <span className={TYPE_COLOR[r.utilityType]}>
                    {TYPE_LABEL[r.utilityType] || r.utilityType}
                  </span>
                </td>
                <td className="p-3 text-slate-300">{r.meterName || "—"}</td>
                <td className="p-3 text-white font-medium">
                  {r.reading} {r.unit}
                </td>
                <td className="p-3 text-slate-300">
                  {r.cost.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-slate-500">{r.notes || "—"}</td>
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
            <h2 className="font-semibold text-white">Log meter reading</h2>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.utilityType}
                onChange={(e) => {
                  const t = e.target.value;
                  setForm({
                    ...form,
                    utilityType: t,
                    unit:
                      t === "POWER"
                        ? "kWh"
                        : t === "COMPRESSED_AIR"
                          ? "h"
                          : "unit",
                  });
                }}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t] || t}
                  </option>
                ))}
              </select>
              <input
                placeholder="Meter name"
                value={form.meterName}
                onChange={(e) =>
                  setForm({ ...form, meterName: e.target.value })
                }
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                placeholder="Reading"
                value={form.reading}
                onChange={(e) => setForm({ ...form, reading: e.target.value })}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                placeholder="Cost ₹"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="datetime-local"
                value={form.readAt}
                onChange={(e) => setForm({ ...form, readAt: e.target.value })}
                className="col-span-2 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "create-reading",
                    data: { ...form, readAt: form.readAt || undefined },
                  });
                  if (ok) {
                    setShow(false);
                    setForm({
                      utilityType: "POWER",
                      meterName: "",
                      reading: "",
                      unit: "kWh",
                      cost: "",
                      readAt: "",
                      notes: "",
                    });
                  }
                }}
                disabled={saving || !form.reading}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
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
