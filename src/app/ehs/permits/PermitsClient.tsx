"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  Loader2,
  BadgeCheck,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Machine {
  id: string;
  name: string;
  code: string;
}
interface Job {
  id: string;
  status: string;
  description: string;
  machine: Machine;
}
interface Permit {
  id: string;
  permitNo: string;
  type: string;
  description: string;
  location: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  ehsApprovedBy: string | null;
  maintApprovedBy: string | null;
  prodApprovedBy: string | null;
  validFrom: string;
  validUntil: string;
  voidedBy: string | null;
  maintenanceJob: Job;
}

const TYPE_META: Record<string, { label: string; cls: string; icon: string }> =
  {
    HOT_WORK: {
      label: "Hot Work",
      cls: "bg-orange-500/15 text-orange-300 border-orange-500/40",
      icon: "🔥",
    },
    HEIGHT_WORK: {
      label: "Height Work",
      cls: "bg-sky-500/15 text-sky-300 border-sky-500/40",
      icon: "🪜",
    },
    CONFINED_SPACE: {
      label: "Confined Space",
      cls: "bg-violet-500/15 text-violet-300 border-violet-500/40",
      icon: "⛓️",
    },
    ELECTRICAL: {
      label: "Electrical",
      cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      icon: "⚡",
    },
    EXCAVATION: {
      label: "Excavation",
      cls: "bg-teal-500/15 text-teal-300 border-teal-500/40",
      icon: "⛏️",
    },
  };

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> =
  {
    PENDING: {
      label: "PENDING",
      cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      dot: "bg-amber-400",
    },
    APPROVED: {
      label: "APPROVED",
      cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      dot: "bg-emerald-400",
    },
    VOID: {
      label: "VOID",
      cls: "bg-rose-500/15 text-rose-300 border-rose-500/40",
      dot: "bg-rose-400",
    },
    EXPIRED: {
      label: "EXPIRED",
      cls: "bg-slate-500/15 text-slate-300 border-slate-500/40",
      dot: "bg-slate-400",
    },
  };

const APPROVAL_STEPS = [
  { key: "ehs", label: "EHS", by: "ehsApprovedBy", perm: "ehs.edit" },
  {
    key: "maint",
    label: "Maintenance",
    by: "maintApprovedBy",
    perm: "maintenance.edit",
  },
  { key: "prod", label: "Production", by: "prodApprovedBy", perm: "ops.edit" },
] as const;

export default function PermitsClient() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    maintenanceJobId: "",
    type: "HOT_WORK",
    description: "",
    location: "",
    validUntil: "",
  });
  const [approveFor, setApproveFor] = useState<Permit | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/permits", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setPermits(data.permits || []);
        setOpenJobs(data.openJobs || []);
      }
    } catch (e) {
      setMsg("Failed to load permits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitForm = async () => {
    if (
      !form.maintenanceJobId ||
      !form.description ||
      !form.location ||
      !form.validUntil
    ) {
      setMsg("All fields required (permit duration window too)");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Create failed");
        return;
      }
      setShowCreate(false);
      setForm({
        maintenanceJobId: "",
        type: "HOT_WORK",
        description: "",
        location: "",
        validUntil: "",
      });
      await load();
    } catch (e) {
      setMsg("Create failed");
    } finally {
      setBusy(false);
    }
  };

  const approve = async (permit: Permit, action: string) => {
    if (!reason.trim()) {
      setMsg("A written reason is required for approval");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/permits/${permit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Action failed");
        return;
      }
      setApproveFor(null);
      setReason("");
      await load();
    } catch (e) {
      setMsg("Action failed");
    } finally {
      setBusy(false);
    }
  };

  const voidPermit = async (permit: Permit) => {
    if (!reason.trim()) {
      setMsg("A written reason is required to void");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/permits/${permit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VOID", reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Void failed");
        return;
      }
      setApproveFor(null);
      setReason("");
      await load();
    } catch (e) {
      setMsg("Void failed");
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = permits.filter((p) => p.status === "PENDING").length;
  const approvedCount = permits.filter((p) => p.status === "APPROVED").length;
  const expiredCount = permits.filter(
    (p) => p.status === "EXPIRED" || p.status === "VOID",
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Permits raised</div>
          <div className="text-2xl font-black text-white mt-1">
            {permits.length}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Awaiting approvals</div>
          <div className="text-2xl font-black text-amber-300 mt-1">
            {pendingCount}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Approved (valid)</div>
          <div className="text-2xl font-black text-emerald-300 mt-1">
            {approvedCount}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Void / Expired</div>
          <div className="text-2xl font-black text-rose-300 mt-1">
            {expiredCount}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-lime-500" />
            <span className="text-sm font-bold text-white">
              Permit Register
            </span>
          </div>
          <Button onClick={() => setShowCreate((v) => !v)}>
            + Raise Permit
          </Button>
        </div>

        {showCreate && (
          <div className="p-4 border-b border-slate-700 space-y-3 bg-slate-900/40">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">
                  Maintenance job *
                </label>
                <Select
                  value={form.maintenanceJobId}
                  onChange={(e) =>
                    setForm({ ...form, maintenanceJobId: e.target.value })
                  }
                >
                  <option value="">Select open job…</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.machine.name} — {j.description.slice(0, 60)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Work type *</label>
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Location *</label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="e.g. Shopfloor bay 2, mezzanine level"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Valid until *</label>
                <Input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) =>
                    setForm({ ...form, validUntil: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400">
                  Scope of work *
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="What will be done, isolation steps, PPE required…"
                  rows={2}
                  className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={submitForm} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Permit"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading permits…
          </div>
        ) : permits.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            No permits yet — raise one for any hot / height / confined-space
            job.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/60">
            {permits.map((p) => {
              const tm = TYPE_META[p.type] || {
                label: p.type,
                cls: "bg-slate-500/15 text-slate-300",
                icon: "🛠️",
              };
              const sm = STATUS_META[p.status] || STATUS_META.PENDING;
              const signed = APPROVAL_STEPS.filter(
                (s) => (p as any)[s.by],
              ).length;
              return (
                <div
                  key={p.id}
                  className="p-4 hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">
                          {p.permitNo}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tm.cls}`}
                        >
                          {tm.icon} {tm.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sm.cls}`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${sm.dot} mr-1 align-middle`}
                          />
                          {sm.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {p.maintenanceJob.machine.name}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300 mt-1">
                        {p.description}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {p.location} · raised by {p.requestedBy} · valid until{" "}
                        {new Date(p.validUntil).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {APPROVAL_STEPS.map((s) => {
                        const who = (p as any)[s.by];
                        return (
                          <div
                            key={s.key}
                            title={`${s.label}: ${who ? `approved by ${who}` : "not signed"}`}
                            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${who ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-slate-700/40 text-slate-400 border-slate-600"}`}
                          >
                            {who ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {s.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {(p.status === "PENDING" || p.status === "APPROVED") && (
                    <div className="flex gap-2 mt-3">
                      {APPROVAL_STEPS.filter((s) => !(p as any)[s.by]).map(
                        (s) => (
                          <Button
                            key={s.key}
                            size="sm"
                            onClick={() => {
                              setApproveFor(p);
                              setReason("");
                            }}
                          >
                            Approve as {s.label}
                          </Button>
                        ),
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setApproveFor(p);
                          setReason("");
                        }}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> Void
                      </Button>
                    </div>
                  )}
                  {signed < 3 && p.status === "APPROVED" && (
                    <div className="text-[10px] text-slate-500 mt-1">
                      Work may start only after all 3 approvals — the
                      maintenance START action enforces this.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {approveFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setApproveFor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-lime-500" />
              <h3 className="font-bold text-white">
                Permit action — {approveFor.permitNo}
              </h3>
            </div>
            <p className="text-sm text-slate-400">
              {approveFor.description} ·{" "}
              {TYPE_META[approveFor.type]?.label || approveFor.type} on{" "}
              {approveFor.maintenanceJob.machine.name}
            </p>
            <div>
              <label className="text-xs text-slate-400">
                Signed reason (mandatory — audit trail) *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Hazards assessed, controls in place, PPE verified…"
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setApproveFor(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const pendingSlots = APPROVAL_STEPS.filter(
                    (s) => !(approveFor as any)[s.by],
                  );
                  if (pendingSlots.length === 0) {
                    voidPermit(approveFor);
                  } else {
                    approve(approveFor, `approve-${pendingSlots[0].key}`);
                  }
                }}
                disabled={busy || !reason.trim()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : approveFor.status === "APPROVED" ? (
                  "Void Permit"
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {msg}
        </div>
      )}
      {!loading && permits.some((p) => p.status === "PENDING") && (
        <div className="flex items-start gap-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Pending permits hard-block the maintenance START action until all 3
            approvals are in — try starting the job from the Maintenance page.
          </span>
        </div>
      )}
    </div>
  );
}
