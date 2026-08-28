"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Ticket, Plus } from "lucide-react";

const PRIO_STYLE: Record<string, string> = {
  LOW: "bg-slate-600/40 text-slate-300 border-slate-600",
  MEDIUM: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  HIGH: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/40",
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-red-500/20 text-red-300 border-red-500/40",
  IN_PROGRESS: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  RESOLVED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CLOSED: "bg-slate-600/40 text-slate-300",
};

export default function TicketsClient() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [slaHours, setSlaHours] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "HARDWARE",
    priority: "MEDIUM",
    assignedToId: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/it-tickets");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setTickets(d.tickets || []);
      setUsers(d.users || []);
      setStats(d.stats || {});
      setCategories(d.categories || []);
      setPriorities(d.priorities || []);
      setSlaHours(d.slaHours || {});
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
      const res = await fetch("/api/it-tickets", {
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
            <Ticket className="w-4 h-4" /> M31 — IT Service Desk
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            IT Tickets with SLA
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            SLA from raise:{" "}
            {Object.entries(slaHours)
              .map(([p, h]) => `${p} ${h}h`)
              .join(" · ")}
            . Overdue tickets are flagged live.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Raise ticket
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Open", value: stats.open, color: "text-red-300" },
          {
            label: "In progress",
            value: stats.inProgress,
            color: "text-sky-300",
          },
          {
            label: "Overdue",
            value: stats.overdue,
            color: stats.overdue ? "text-red-400" : "text-emerald-300",
          },
          {
            label: "Resolved",
            value: stats.resolved,
            color: "text-emerald-300",
          },
          {
            label: "Critical open",
            value: stats.criticalOpen,
            color: stats.criticalOpen ? "text-red-400" : "text-slate-300",
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Ticket</th>
              <th className="p-3">Title</th>
              <th className="p-3">Category</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Status</th>
              <th className="p-3">SLA</th>
              <th className="p-3">Raised by</th>
              <th className="p-3">Assigned to</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-400">
                  No tickets yet.
                </td>
              </tr>
            )}
            {tickets.map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-300 whitespace-nowrap">
                  {t.ticketNumber}
                </td>
                <td className="p-3 font-medium text-white">{t.title}</td>
                <td className="p-3 text-slate-300">{t.category}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIO_STYLE[t.priority] || ""}`}
                  >
                    {t.priority}
                  </span>
                </td>
                <td className="p-3">
                  <select
                    value={t.status}
                    onChange={(e) =>
                      api({
                        action: "update-ticket",
                        data: { id: t.id, status: e.target.value },
                      })
                    }
                    className="rounded-lg bg-slate-900/60 border border-slate-700 px-2 py-1 text-xs text-white"
                  >
                    {Object.keys(STATUS_STYLE).map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  {t.status === "RESOLVED" || t.status === "CLOSED" ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                      MET
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${t.sla?.overdue ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}
                    >
                      {t.sla?.overdue
                        ? `OVERDUE ${t.sla.hoursLeft}h`
                        : `ON TRACK · ${t.sla?.hoursLeft}h left`}
                    </span>
                  )}
                </td>
                <td className="p-3 text-slate-400">
                  {t.raisedBy?.name || "—"}
                </td>
                <td className="p-3">
                  <select
                    value={t.assignedToId || ""}
                    onChange={(e) =>
                      api({
                        action: "update-ticket",
                        data: {
                          id: t.id,
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
                <td className="p-3 text-right">
                  <button
                    onClick={() => {
                      const r = window.prompt("Resolution:");
                      if (r)
                        api({
                          action: "update-ticket",
                          data: { id: t.id, resolution: r, status: "RESOLVED" },
                        });
                    }}
                    disabled={t.status === "CLOSED"}
                    className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-2 py-1 text-[11px] text-white"
                  >
                    Resolve
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
            <h2 className="font-semibold text-white">Raise ticket</h2>
            <input
              placeholder="Title (e.g. Laptop won't boot)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p} — SLA {slaHours[p]}h
                  </option>
                ))}
              </select>
            </div>
            <select
              value={form.assignedToId}
              onChange={(e) =>
                setForm({ ...form, assignedToId: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            >
              <option value="">Assign to… (optional)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({ action: "create-ticket", data: form });
                  if (ok) {
                    setShow(false);
                    setForm({
                      title: "",
                      category: "HARDWARE",
                      priority: "MEDIUM",
                      assignedToId: "",
                    });
                  }
                }}
                disabled={saving || !form.title}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Raise
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
