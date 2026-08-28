"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EscalationStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Escalation {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  severity: Severity;
  status: EscalationStatus;
  escalatedAt: string;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Candidate {
  sourceType: string;
  sourceId: string;
  title: string;
  severity: string;
  dueDate: string | null;
}

const STATUSES: EscalationStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];
const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const sevStyles: Record<Severity, string> = {
  LOW: "bg-slate-800/60 text-slate-300",
  MEDIUM: "bg-amber-900/40 text-amber-300",
  HIGH: "bg-orange-900/40 text-orange-300",
  CRITICAL: "bg-red-900/40 text-red-300",
};

const statusStyles: Record<EscalationStatus, string> = {
  OPEN: "border-red-900/50 bg-red-950/30",
  ACKNOWLEDGED: "border-amber-900/50 bg-amber-950/30",
  RESOLVED: "border-emerald-900/50 bg-emerald-950/30",
};

const sourceBadges: Record<string, string> = {
  AUDIT_FINDING: "bg-indigo-900/40 text-indigo-300",
  BUDGET: "bg-purple-900/40 text-purple-300",
  NCR: "bg-rose-900/40 text-rose-300",
  CUSTOM: "bg-slate-800/60 text-slate-400",
};

export default function EscalationsClient() {
  const [items, setItems] = useState<Escalation[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [escalatedKeys, setEscalatedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    severity: "MEDIUM" as Severity,
    dueDate: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/escalations");
      const data = await res.json();
      setItems(Array.isArray(data.escalations) ? data.escalations : []);
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setEscalatedKeys(
        Array.isArray(data.escalatedKeys) ? data.escalatedKeys : [],
      );
    } catch {
      setItems([]);
      setCandidates([]);
      setEscalatedKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (action: string, data: Record<string, unknown>) => {
    const res = await fetch("/api/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const escalate = async (c: Candidate) => {
    setBusy(true);
    try {
      await post("create", {
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        title: c.title,
        severity: c.severity,
        dueDate: c.dueDate,
      });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Escalation failed");
    } finally {
      setBusy(false);
    }
  };

  const ack = async (id: string) => {
    await post("ack", { id });
    await load();
  };

  const resolve = async (id: string) => {
    await post("resolve", { id });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this escalation?")) return;
    await post("delete", { id });
    await load();
  };

  const createCustom = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("create", {
        sourceType: "CUSTOM",
        sourceId: `custom-${Date.now()}`,
        title: form.title,
        severity: form.severity,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      });
      setModalOpen(false);
      setForm({ title: "", severity: "MEDIUM", dueDate: "", notes: "" });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const pendingCandidates = useMemo(
    () =>
      candidates.filter(
        (c) => !escalatedKeys.includes(`${c.sourceType}:${c.sourceId}`),
      ),
    [candidates, escalatedKeys],
  );

  const counts = useMemo(() => {
    const c: Record<EscalationStatus, number> = {
      OPEN: 0,
      ACKNOWLEDGED: 0,
      RESOLVED: 0,
    };
    items.forEach((i) => {
      c[i.status] += 1;
    });
    return c;
  }, [items]);

  const openCritical = useMemo(
    () =>
      items.filter((i) => i.severity === "CRITICAL" && i.status !== "RESOLVED")
        .length,
    [items],
  );

  return (
    <div>
      {/* Auto-escalation candidates */}
      <div className="mb-6 rounded-xl border border-indigo-800/50 bg-indigo-950/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-indigo-900">
            ⚡ Auto-detected escalation candidates
          </h2>
          <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
            {pendingCandidates.length}
          </span>
        </div>
        {pendingCandidates.length === 0 ? (
          <p className="text-xs text-indigo-300/70">
            Nothing pending — open audit findings, budget overruns and open NCRs
            will appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingCandidates.map((c) => (
              <div
                key={`${c.sourceType}:${c.sourceId}`}
                className="bg-slate-800/60 border border-indigo-800/40 p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sourceBadges[c.sourceType] || sourceBadges.CUSTOM}`}
                  >
                    {c.sourceType.replace("_", " ")}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevStyles[c.severity as Severity] || sevStyles.MEDIUM}`}
                  >
                    {c.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-medium mt-2 leading-snug">
                  {c.title}
                </p>
                <button
                  onClick={() => escalate(c)}
                  disabled={busy}
                  className="mt-2 w-full text-xs font-bold px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Escalate
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {openCritical > 0 && (
          <div className="px-4 py-2 rounded-md bg-red-950/30 border border-red-900/50 text-red-300 text-sm font-semibold">
            🚨 {openCritical} critical escalation{openCritical > 1 ? "s" : ""}{" "}
            still open.
          </div>
        )}
        <button
          onClick={() => setModalOpen(true)}
          className="ml-auto px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
        >
          + Custom Escalation
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading escalations…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">
          No escalations yet — escalate a candidate above or raise a custom one.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((status) => (
            <div
              key={status}
              className={`rounded-lg border p-3 ${statusStyles[status]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-200">{status}</h3>
                <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full">
                  {counts[status]}
                </span>
              </div>
              <div className="space-y-2">
                {items
                  .filter((i) => i.status === status)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-800/60 rounded-md border border-slate-700 p-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white leading-snug">
                          {item.title}
                        </p>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${sevStyles[item.severity]}`}
                        >
                          {item.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sourceBadges[item.sourceType] || sourceBadges.CUSTOM}`}
                        >
                          {item.sourceType.replace("_", " ")}
                        </span>
                        {item.dueDate && (
                          <span className="text-[11px] text-slate-400">
                            due {item.dueDate.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {item.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        {status === "OPEN" && (
                          <button
                            onClick={() => ack(item.id)}
                            className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold hover:bg-amber-500/20"
                          >
                            Acknowledge
                          </button>
                        )}
                        {status !== "RESOLVED" && (
                          <button
                            onClick={() => resolve(item.id)}
                            className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-semibold hover:bg-emerald-500/20"
                          >
                            Resolve
                          </button>
                        )}
                        <button
                          onClick={() => remove(item.id)}
                          className="text-[11px] px-2 py-0.5 rounded bg-red-950/40 text-red-300 font-semibold hover:bg-red-900/40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-slate-800/60 rounded-xl shadow-xl w-full max-w-md p-5">
            <h2 className="text-lg font-bold text-white mb-4">
              Raise Custom Escalation
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-slate-600 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. Customer insists on early delivery of WO-2026-014"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Severity
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      setForm({ ...form, severity: e.target.value as Severity })
                    }
                    className="w-full border border-slate-600 rounded-md px-3 py-2 text-sm"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                    className="w-full border border-slate-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-slate-600 rounded-md px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-md border border-slate-600 text-sm font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={createCustom}
                disabled={busy}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
