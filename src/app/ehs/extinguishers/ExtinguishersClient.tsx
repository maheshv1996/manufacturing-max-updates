"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Flame,
  Plus,
  MapPin,
  ClipboardCheck,
  Wrench,
} from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  OK: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  DUE: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  OVERDUE: "bg-red-500/20 text-red-300 border-red-500/40",
};

export default function ExtinguishersClient() {
  const [, setExtinguishers] = useState<any[]>([]);
  const [map, setMap] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [month, setMonth] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [inspectFor, setInspectFor] = useState<any>(null);
  const [form, setForm] = useState({
    location: "",
    type: "DCP",
    capacityKg: "",
  });
  const [iForm, setIForm] = useState({ conditionOk: true, notes: "" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/extinguishers");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setExtinguishers(d.extinguishers || []);
      setMap(d.map || []);
      setChecklist(d.checklist || []);
      setMonth(d.month || "");
      setTypes(d.types || []);
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
      const res = await fetch("/api/extinguishers", {
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
            <Flame className="w-4 h-4" /> M26 — Extinguisher Map & Monthly
            Inspection
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Fire Extinguisher Register
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            One inspection per unit per month — units missed last month go
            straight to OVERDUE.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Add extinguisher
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Units", value: stats.total, color: "text-white" },
          { label: "Locations", value: stats.locations, color: "text-sky-300" },
          { label: "Inspected", value: stats.ok, color: "text-emerald-300" },
          {
            label: "Due this month",
            value: stats.due,
            color: "text-amber-300",
          },
          { label: "OVERDUE", value: stats.overdue, color: "text-red-400" },
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {map.map((loc) => (
          <div
            key={loc.location}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MapPin className="w-4 h-4 text-red-400" /> {loc.location}
              <span className="ml-auto flex gap-1">
                {loc.overdue > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                    {loc.overdue} overdue
                  </span>
                )}
                {loc.due > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {loc.due} due
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {loc.ok} ok
                </span>
              </span>
            </div>
            <div className="mt-3 space-y-1.5">
              {loc.units.map((e: any) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg bg-slate-900/60 border border-slate-700 px-2.5 py-1.5 text-xs"
                >
                  <span className="text-slate-200">
                    {e.code} · {e.type} {e.capacityKg}kg
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[e.status] || ""}`}
                  >
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {map.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
            No extinguishers on the map yet.
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <div className="px-4 pt-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-lime-300" /> Monthly
            inspection checklist — {month}
          </h2>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Unit</th>
              <th className="p-3">Location</th>
              <th className="p-3">Type</th>
              <th className="p-3">Last inspected</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {checklist.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  All units inspected this month.
                </td>
              </tr>
            )}
            {checklist.map((e) => (
              <tr
                key={e.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-300">{e.code}</td>
                <td className="p-3 text-white">{e.location}</td>
                <td className="p-3 text-slate-300">
                  {e.type} {e.capacityKg}kg
                </td>
                <td className="p-3 text-slate-300">
                  {e.lastInspected
                    ? new Date(e.lastInspected).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[e.status] || ""}`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => {
                      setInspectFor(e);
                      setIForm({ conditionOk: true, notes: "" });
                    }}
                    className="rounded-lg bg-lime-600/80 hover:bg-lime-500 px-2.5 py-1 text-xs font-semibold text-white flex items-center gap-1 ml-auto"
                  >
                    <Wrench className="w-3 h-3" /> Inspect
                  </button>
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
            <h2 className="font-semibold text-white">Add extinguisher</h2>
            <input
              placeholder="Location (e.g. CNC bay — pillar 3)"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Capacity (kg)"
              value={form.capacityKg}
              onChange={(e) => setForm({ ...form, capacityKg: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "create-extinguisher",
                    data: form,
                  });
                  if (ok) {
                    setShow(false);
                    setForm({ location: "", type: "DCP", capacityKg: "" });
                  }
                }}
                disabled={saving || !form.location}
                className="flex-1 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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

      {inspectFor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setInspectFor(null)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">
              Monthly inspection — {inspectFor.code} ({inspectFor.location})
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => setIForm({ ...iForm, conditionOk: true })}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold border ${iForm.conditionOk ? "bg-emerald-600 border-emerald-400 text-white" : "bg-slate-900/60 border-slate-700 text-slate-300"}`}
              >
                Condition OK
              </button>
              <button
                onClick={() => setIForm({ ...iForm, conditionOk: false })}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold border ${!iForm.conditionOk ? "bg-red-600 border-red-400 text-white" : "bg-slate-900/60 border-slate-700 text-slate-300"}`}
              >
                Needs service
              </button>
            </div>
            <input
              placeholder="Notes (e.g. pressure low, seal broken)"
              value={iForm.notes}
              onChange={(e) => setIForm({ ...iForm, notes: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "record-inspection",
                    data: {
                      extinguisherId: inspectFor.id,
                      conditionOk: iForm.conditionOk,
                      notes: iForm.notes,
                    },
                  });
                  if (ok) setInspectFor(null);
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Record inspection
              </button>
              <button
                onClick={() => setInspectFor(null)}
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
