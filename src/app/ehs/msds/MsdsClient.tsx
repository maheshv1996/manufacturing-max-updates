"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, TestTube, Plus, MapPin, FileWarning } from "lucide-react";

export default function MsdsClient() {
  const [chemicals, setChemicals] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    locations: 0,
    msdsMissing: 0,
    reviewDue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    casNumber: "",
    hazards: "",
    storageLocation: "",
    quantityOnHand: "",
    unit: "L",
    msdsFilePath: "",
    msdsReviewDate: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/chemicals");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setChemicals(d.chemicals || []);
      setLocations(d.locations || []);
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
      const res = await fetch("/api/chemicals", {
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

  const openEdit = (c: any) => {
    setEdit(c);
    setForm({
      name: c.name,
      casNumber: c.casNumber || "",
      hazards: c.hazards,
      storageLocation: c.storageLocation,
      quantityOnHand: String(c.quantityOnHand ?? ""),
      unit: c.unit || "L",
      msdsFilePath: c.msdsFilePath || "",
      msdsReviewDate: c.msdsReviewDate
        ? new Date(c.msdsReviewDate).toISOString().slice(0, 10)
        : "",
    });
    setShow(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-lime-300 font-semibold">
            <TestTube className="w-4 h-4" /> M24 — Chemical / MSDS Register
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Chemicals & Material Safety Data Sheets
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every chemical carries its hazard summary, storage location and SDS
            reference.
          </p>
        </div>
        <button
          onClick={() => {
            setEdit(null);
            setForm({
              name: "",
              casNumber: "",
              hazards: "",
              storageLocation: "",
              quantityOnHand: "",
              unit: "L",
              msdsFilePath: "",
              msdsReviewDate: "",
            });
            setShow(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Add chemical
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Chemicals", value: stats.total, color: "text-white" },
          {
            label: "Storage locations",
            value: stats.locations,
            color: "text-sky-300",
          },
          {
            label: "MSDS missing",
            value: stats.msdsMissing,
            color: stats.msdsMissing ? "text-red-400" : "text-emerald-300",
          },
          {
            label: "SDS review due (>365d)",
            value: stats.reviewDue,
            color: stats.reviewDue ? "text-amber-300" : "text-emerald-300",
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
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-300" /> Storage locations
        </h2>
        <div className="flex flex-wrap gap-2">
          {locations.map((l) => (
            <div
              key={l.name}
              className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-xs"
            >
              <span className="text-white font-semibold">{l.name}</span>
              <span className="text-slate-400">
                {" "}
                · {l.chemicals} chemical(s)
              </span>
            </div>
          ))}
          {locations.length === 0 && (
            <div className="text-sm text-slate-400">
              No storage locations mapped yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {chemicals.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <TestTube className="w-4 h-4 text-lime-300" /> {c.name}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {c.chemicalNumber}
                  {c.casNumber ? ` · CAS ${c.casNumber}` : ""}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-slate-200 font-semibold">
                  {c.quantityOnHand} {c.unit}
                </div>
                <div className="text-[10px] text-slate-500">on hand</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5 text-xs">
              <FileWarning className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
              <span className="text-amber-200/90">{c.hazards}</span>
            </div>
            <div className="text-xs text-slate-400">
              <span className="text-slate-200">SDS: </span>
              {c.msdsFilePath ? (
                <a
                  href={c.msdsFilePath}
                  target="_blank"
                  className="text-sky-300 underline"
                >
                  {c.msdsFilePath}
                </a>
              ) : (
                <span className="text-red-400">MISSING</span>
              )}
              {c.msdsReviewDate
                ? ` · reviewed ${new Date(c.msdsReviewDate).toLocaleDateString()}`
                : ""}
            </div>
            <button
              onClick={() => openEdit(c)}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs text-slate-200"
            >
              Update / review SDS
            </button>
          </div>
        ))}
        {chemicals.length === 0 && (
          <div className="md:col-span-2 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
            No chemicals on the register yet.
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
            <h2 className="font-semibold text-white">
              {edit ? `Update ${edit.name}` : "Add chemical"}
            </h2>
            <input
              placeholder="Chemical name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              placeholder="CAS number (optional)"
              value={form.casNumber}
              onChange={(e) => setForm({ ...form, casNumber: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              placeholder="Hazards (e.g. Flammable, Toxic, Corrosive)"
              value={form.hazards}
              onChange={(e) => setForm({ ...form, hazards: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              placeholder="Storage location (e.g. Chemical store Bay A / rack 2)"
              value={form.storageLocation}
              onChange={(e) =>
                setForm({ ...form, storageLocation: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Qty on hand"
                value={form.quantityOnHand}
                onChange={(e) =>
                  setForm({ ...form, quantityOnHand: e.target.value })
                }
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
              />
              <input
                placeholder="Unit (L / kg)"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-24 rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
              />
            </div>
            <input
              placeholder="SDS file path / URL (optional)"
              value={form.msdsFilePath}
              onChange={(e) =>
                setForm({ ...form, msdsFilePath: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              type="date"
              value={form.msdsReviewDate}
              onChange={(e) =>
                setForm({ ...form, msdsReviewDate: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api(
                    edit
                      ? {
                          action: "update-chemical",
                          data: { id: edit.id, ...form },
                        }
                      : { action: "create-chemical", data: form },
                  );
                  if (ok) setShow(false);
                }}
                disabled={
                  saving || !form.name || !form.hazards || !form.storageLocation
                }
                className="flex-1 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {edit ? "Save" : "Add"}
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
