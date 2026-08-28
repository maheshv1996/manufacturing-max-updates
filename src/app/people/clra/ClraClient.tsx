"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  HardHat,
  Plus,
  FileBadge,
  UserPlus,
  LogOut,
} from "lucide-react";

const LICENSE_STYLE: Record<string, string> = {
  VALID: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  EXPIRING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  EXPIRED: "bg-red-500/20 text-red-300 border-red-500/40",
};

export default function ClraClient() {
  const [contractors, setContractors] = useState<any[]>([]);
  const [labour, setLabour] = useState<any[]>([]);
  const [stats, setStats] = useState({
    contractors: 0,
    activeLabour: 0,
    expiring: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showContractor, setShowContractor] = useState(false);
  const [cForm, setCForm] = useState({
    name: "",
    licenseNumber: "",
    licenseValidUntil: "",
    gstin: "",
    address: "",
    phone: "",
  });
  const [labourFor, setLabourFor] = useState<string | null>(null);
  const [lForm, setLForm] = useState({
    name: "",
    workType: "",
    wagePerDay: "",
    joinedAt: "",
    aadharLast4: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/clra");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setContractors(d.contractors || []);
      setLabour(d.labour || []);
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
      const res = await fetch("/api/clra", {
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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <HardHat className="w-4 h-4" /> M23 — Contract Labour (Regulation &
            Abolition) Act
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Contract Labour Register
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Contractor licences ≤ 90 days from renewal flag the digest and the
            bell; an expired licence is critical — no contract labour without a
            valid licence.
          </p>
        </div>
        <button
          onClick={() => setShowContractor(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Add contractor
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Contractors",
            value: stats.contractors,
            color: "text-white",
          },
          {
            label: "Active labour",
            value: stats.activeLabour,
            color: "text-emerald-300",
          },
          {
            label: "Licences expiring (≤90d)",
            value: stats.expiring,
            color: "text-amber-300",
          },
          {
            label: "Licences EXPIRED",
            value: stats.expired,
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

      <div className="grid gap-4 md:grid-cols-2">
        {contractors.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-indigo-300" /> {c.name}
                  {!c.isActive && (
                    <span className="text-xs text-slate-400">(inactive)</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {c.code} · {c.gstin || "no GSTIN"}{" "}
                  {c.phone ? `· ${c.phone}` : ""}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${LICENSE_STYLE[c.licenseStatus] || ""}`}
              >
                <FileBadge className="w-3 h-3" /> {c.licenseStatus}
                {c.daysLeft > 0 && c.daysLeft <= 90 ? ` · ${c.daysLeft}d` : ""}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Licence <span className="text-slate-200">{c.licenseNumber}</span>{" "}
              · valid until{" "}
              <span className="text-slate-200">
                {new Date(c.licenseValidUntil).toLocaleDateString()}
              </span>{" "}
              ·{" "}
              <span className="text-emerald-300">{c.activeLabour} active</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const until = window.prompt(
                    `Renew / update licence valid-until (YYYY-MM-DD) for ${c.name}:`,
                    new Date(c.licenseValidUntil).toISOString().slice(0, 10),
                  );
                  if (until !== null)
                    api({
                      action: "update-contractor",
                      data: { id: c.id, licenseValidUntil: until },
                    });
                }}
                className="rounded-lg bg-amber-600/80 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Renew / edit licence
              </button>
              <button
                onClick={() => {
                  setLabourFor(c.id);
                  setLForm({
                    name: "",
                    workType: "",
                    wagePerDay: "",
                    joinedAt: new Date().toISOString().slice(0, 10),
                    aadharLast4: "",
                  });
                }}
                className="rounded-lg bg-indigo-600/80 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add labour
              </button>
            </div>
            <div className="text-xs text-slate-500 max-h-24 overflow-y-auto space-y-1">
              {c.labour.length === 0 && <div>No active labour records.</div>}
              {c.labour.map((l: any) => (
                <div key={l.id} className="flex justify-between">
                  <span>
                    {l.name} · {l.workType}
                  </span>
                  <span>₹{l.wagePerDay}/day</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {contractors.length === 0 && (
          <div className="md:col-span-2 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
            No contractors on the register yet.
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-white">
            Contract labour register
          </h2>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Name</th>
              <th className="p-3">Contractor</th>
              <th className="p-3">Work type</th>
              <th className="p-3">Wage / day</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {labour.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  No labour records.
                </td>
              </tr>
            )}
            {labour.map((l) => (
              <tr
                key={l.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-white">
                  {l.name}{" "}
                  {l.aadharLast4 ? (
                    <span className="text-xs text-slate-400">
                      ···{l.aadharLast4}
                    </span>
                  ) : null}
                </td>
                <td className="p-3 text-slate-300">
                  {l.contractor?.name || "—"}
                </td>
                <td className="p-3 text-slate-300">{l.workType}</td>
                <td className="p-3 text-slate-300">₹{l.wagePerDay}</td>
                <td className="p-3 text-slate-300">
                  {new Date(l.joinedAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${l.isActive ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-700/40 text-slate-400"}`}
                  >
                    {l.isActive ? "ACTIVE" : "LEFT"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {l.isActive ? (
                    <button
                      onClick={() => {
                        const d = window.prompt(
                          `Relieving date for ${l.name} (YYYY-MM-DD):`,
                          new Date().toISOString().slice(0, 10),
                        );
                        if (d !== null)
                          api({
                            action: "update-labour",
                            data: { id: l.id, leftAt: d },
                          });
                      }}
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-xs text-slate-200 flex items-center gap-1 ml-auto"
                    >
                      <LogOut className="w-3 h-3" /> Relieve
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        api({
                          action: "update-labour",
                          data: { id: l.id, leftAt: null },
                        })
                      }
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-xs text-slate-200"
                    >
                      Re-instate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showContractor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowContractor(false)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">Add contractor</h2>
            <input
              placeholder="Name"
              value={cForm.name}
              onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="CLRA licence number"
              value={cForm.licenseNumber}
              onChange={(e) =>
                setCForm({ ...cForm, licenseNumber: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              type="date"
              value={cForm.licenseValidUntil}
              onChange={(e) =>
                setCForm({ ...cForm, licenseValidUntil: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="GSTIN (optional)"
              value={cForm.gstin}
              onChange={(e) => setCForm({ ...cForm, gstin: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Phone (optional)"
              value={cForm.phone}
              onChange={(e) => setCForm({ ...cForm, phone: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "create-contractor",
                    data: cForm,
                  });
                  if (ok) {
                    setShowContractor(false);
                    setCForm({
                      name: "",
                      licenseNumber: "",
                      licenseValidUntil: "",
                      gstin: "",
                      address: "",
                      phone: "",
                    });
                  }
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Add
              </button>
              <button
                onClick={() => setShowContractor(false)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {labourFor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setLabourFor(null)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">Add contract labour</h2>
            <input
              placeholder="Full name"
              value={lForm.name}
              onChange={(e) => setLForm({ ...lForm, name: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Work type (e.g. Helper, Welder, Mason)"
              value={lForm.workType}
              onChange={(e) => setLForm({ ...lForm, workType: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              placeholder="Wage per day (₹)"
              value={lForm.wagePerDay}
              onChange={(e) =>
                setLForm({ ...lForm, wagePerDay: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              type="date"
              value={lForm.joinedAt}
              onChange={(e) => setLForm({ ...lForm, joinedAt: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Aadhaar last 4 (optional)"
              value={lForm.aadharLast4}
              onChange={(e) =>
                setLForm({ ...lForm, aadharLast4: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "create-labour",
                    data: { contractorId: labourFor, ...lForm },
                  });
                  if (ok) setLabourFor(null);
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Add labour
              </button>
              <button
                onClick={() => setLabourFor(null)}
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
