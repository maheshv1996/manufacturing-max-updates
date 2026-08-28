"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Droplets, Plus, FileBadge } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  VALID: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  EXPIRING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  EXPIRED: "bg-red-500/20 text-red-300 border-red-500/40",
};

export default function ConsentsClient() {
  const [consents, setConsents] = useState<any[]>([]);
  const [stats, setStats] = useState({
    water: 0,
    air: 0,
    expiring: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    type: "WATER",
    boardRef: "",
    issuedAt: new Date().toISOString().slice(0, 10),
    validUntil: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/consents");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setConsents(d.consents || []);
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
      const res = await fetch("/api/consents", {
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
            <Droplets className="w-4 h-4" /> M25 — Consent Renewals (Pollution
            Control)
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Water & Air Consent Register
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Consents ≤ 90 days from lapse flag the compliance digest and the
            bell; a lapsed consent is critical — the plant cannot operate
            without it.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Add consent
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Water consents",
            value: stats.water,
            color: "text-sky-300",
          },
          { label: "Air consents", value: stats.air, color: "text-white" },
          {
            label: "Expiring (≤90d)",
            value: stats.expiring,
            color: "text-amber-300",
          },
          { label: "EXPIRED", value: stats.expired, color: "text-red-400" },
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
        {consents.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <Droplets
                    className={`w-4 h-4 ${c.type === "WATER" ? "text-sky-300" : "text-lime-300"}`}
                  />{" "}
                  {c.type === "WATER" ? "Water consent" : "Air consent"} ·{" "}
                  {c.boardRef}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {c.consentNumber}
                  {c.notes ? ` · ${c.notes}` : ""}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${STATUS_STYLE[c.renewalStatus] || ""}`}
              >
                <FileBadge className="w-3 h-3" /> {c.renewalStatus}
                {c.daysLeft > 0 && c.daysLeft <= 90 ? ` · ${c.daysLeft}d` : ""}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Issued{" "}
              <span className="text-slate-200">
                {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "—"}
              </span>{" "}
              · valid until{" "}
              <span className="text-slate-200">
                {new Date(c.validUntil).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={() => {
                const until = window.prompt(
                  `Renew ${c.type} consent ${c.boardRef} — new valid-until (YYYY-MM-DD):`,
                  new Date(c.validUntil).toISOString().slice(0, 10),
                );
                if (until !== null)
                  api({
                    action: "renew-consent",
                    data: { id: c.id, validUntil: until },
                  });
              }}
              className="rounded-lg bg-amber-600/80 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Renew consent
            </button>
          </div>
        ))}
        {consents.length === 0 && (
          <div className="md:col-span-2 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
            No consents on the register yet.
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
            <h2 className="font-semibold text-white">Add consent</h2>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            >
              <option value="WATER">Water consent</option>
              <option value="AIR">Air consent</option>
            </select>
            <input
              placeholder="PCB board reference (e.g. MPPCB/W/2025/118)"
              value={form.boardRef}
              onChange={(e) => setForm({ ...form, boardRef: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              type="date"
              value={form.issuedAt}
              onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
            />
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
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
                    action: "create-consent",
                    data: form,
                  });
                  if (ok) {
                    setShow(false);
                    setForm({
                      type: "WATER",
                      boardRef: "",
                      issuedAt: new Date().toISOString().slice(0, 10),
                      validUntil: "",
                      notes: "",
                    });
                  }
                }}
                disabled={saving || !form.boardRef || !form.validUntil}
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

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-slate-800 border border-slate-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
