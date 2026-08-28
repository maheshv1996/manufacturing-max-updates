"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  BadgeCheck,
  Loader2,
  RefreshCcw,
  Database,
  CheckCircle2,
  XCircle,
  UserX,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Certification {
  id: string;
  depts: string[];
  certifiedBy: string;
  certifiedAt: string;
  notes?: string | null;
}
interface Cycle {
  id: string;
  name: string;
  dueDate: string;
  status: string;
  createdBy: string;
  closedAt?: string | null;
}
interface UserRow {
  userId: string;
  name: string;
  username: string;
  role: string;
  level: string;
  depts: string[];
  deptKeys: string[];
  certified: boolean;
  certification: Certification | null;
}
interface Drill {
  id: string;
  backupName: string;
  result: string;
  durationSec?: number | null;
  performedBy: string;
  drillDate: string;
  verifiedAt: string;
  notes?: string | null;
}
interface BackupJob {
  id: string;
  startedAt: string;
  status: string;
}

const RESULT_META: Record<string, { label: string; cls: string }> = {
  PASS: {
    label: "PASS",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  FAIL: {
    label: "FAIL",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  },
  PARTIAL: {
    label: "PARTIAL",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  },
};

export default function AccessReviewClient() {
  const [tab, setTab] = useState<"review" | "drills">("review");
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [backupJobs, setBackupJobs] = useState<BackupJob[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [suspended, setSuspended] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [showCycle, setShowCycle] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [cycleDue, setCycleDue] = useState("");
  const [certFor, setCertFor] = useState<UserRow | null>(null);
  const [certDepts, setCertDepts] = useState<string[]>([]);
  const [certNotes, setCertNotes] = useState("");
  const [showDrill, setShowDrill] = useState(false);
  const [drillForm, setDrillForm] = useState({
    backupJobId: "",
    backupName: "",
    result: "PASS",
    durationSec: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/access-review", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setCycle(data.cycle);
        setRows(data.rows || []);
        setDrills(data.drills || []);
        setBackupJobs(data.backupJobs || []);
        setTotals(data.totals || {});
        setSuspended(data.suspended || []);
      } else {
        setMsg(data.error || "Failed to load");
      }
    } catch {
      setMsg("Failed to load access review");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const daysLeft = cycle
    ? Math.ceil((new Date(cycle.dueDate).getTime() - Date.now()) / 86400000)
    : null;
  const overdue = cycle ? daysLeft !== null && daysLeft < 0 : false;

  const createCycle = async () => {
    if (!cycleName.trim() || !cycleDue) {
      setMsg("Cycle name + due date required");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/access-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-cycle",
          name: cycleName.trim(),
          dueDate: cycleDue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Failed");
        return;
      }
      setShowCycle(false);
      setCycleName("");
      setCycleDue("");
      await load();
    } catch {
      setMsg("Failed to create cycle");
    } finally {
      setBusy(false);
    }
  };

  const certify = async () => {
    if (!certFor) return;
    if (certDepts.length === 0) {
      setMsg("Select at least one department to certify");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/access-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "certify",
          userId: certFor.userId,
          depts: certDepts,
          notes: certNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Certify failed");
        return;
      }
      setCertFor(null);
      setCertNotes("");
      setCertDepts([]);
      await load();
    } catch {
      setMsg("Certify failed");
    } finally {
      setBusy(false);
    }
  };

  const logDrill = async () => {
    if (!drillForm.backupName.trim()) {
      setMsg("Backup name required");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/access-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "drill",
          backupJobId: drillForm.backupJobId || null,
          backupName: drillForm.backupName.trim(),
          result: drillForm.result,
          durationSec: drillForm.durationSec
            ? Number(drillForm.durationSec)
            : null,
          notes: drillForm.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Drill log failed");
        return;
      }
      setShowDrill(false);
      setDrillForm({
        backupJobId: "",
        backupName: "",
        result: "PASS",
        durationSec: "",
        notes: "",
      });
      await load();
    } catch {
      setMsg("Drill log failed");
    } finally {
      setBusy(false);
    }
  };

  const DEPT_KEYS: { key: string; label: string }[] = [
    { key: "executive", label: "Executive" },
    { key: "engineering", label: "Engineering & R&D" },
    { key: "ops", label: "Production / Operations" },
    { key: "quality", label: "Quality (QA / QC)" },
    { key: "metrology", label: "Instrumentation / Metrology" },
    { key: "supply", label: "Supply Chain & Materials" },
    { key: "commercial", label: "Sales & Marketing" },
    { key: "finance", label: "Finance & Accounts" },
    { key: "people", label: "Human Resources" },
    { key: "ehs", label: "EHS" },
    { key: "maintenance", label: "Maintenance & Utilities" },
    { key: "projects", label: "Projects / Program Management" },
    { key: "it", label: "IT & Systems" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            variant={tab === "review" ? "primary" : "ghost"}
            onClick={() => setTab("review")}
          >
            <ShieldCheck className="h-4 w-4 mr-1" /> Quarterly Access Review
          </Button>
          <Button
            variant={tab === "drills" ? "primary" : "ghost"}
            onClick={() => setTab("drills")}
          >
            <Database className="h-4 w-4 mr-1" /> Restore Drills (
            {totals.drills || 0})
          </Button>
        </div>
        {tab === "review" ? (
          <Button
            onClick={() => setShowCycle(true)}
            disabled={!!cycle && cycle.status === "OPEN"}
          >
            + Open Review Cycle
          </Button>
        ) : (
          <Button onClick={() => setShowDrill(true)}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Log Restore Drill
          </Button>
        )}
      </div>

      {suspended.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-rose-200 bg-rose-950/40 border border-rose-700/60 rounded-xl px-3 py-2.5">
          <UserX className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <div>
            <span className="font-bold text-rose-300">
              Auto-suspension executed:
            </span>{" "}
            {suspended.map((s) => s.name).join(", ")} — accounts suspended
            (isActive=false) for missing certification. Audit{" "}
            <span className="font-mono">ACCESS_SUSPENDED</span> written.
            Re-certify in a new cycle and re-activate to restore.
          </div>
        </div>
      )}

      {tab === "review" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Active cycle</div>
              <div className="text-lg font-black text-white mt-1 truncate">
                {cycle ? cycle.name : "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Due</div>
              <div
                className={`text-lg font-black mt-1 ${overdue ? "text-rose-400" : daysLeft !== null && daysLeft <= 14 ? "text-amber-300" : "text-white"}`}
              >
                {cycle ? (overdue ? "OVERDUE" : `${daysLeft}d left`) : "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Certified</div>
              <div className="text-lg font-black text-emerald-300 mt-1">
                {totals.certified ?? 0}/{totals.users ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Uncertified</div>
              <div className="text-lg font-black text-amber-300 mt-1">
                {totals.pending ?? 0}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-slate-700">
              <ShieldCheck className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-bold text-white">
                Certification Grid
              </span>
              {cycle && (
                <span className="text-xs text-slate-500 ml-auto">
                  {cycle.status === "OPEN"
                    ? `created by ${cycle.createdBy}`
                    : `closed ${cycle.closedAt ? new Date(cycle.closedAt).toLocaleDateString() : ""}`}
                </span>
              )}
            </div>
            {!cycle ? (
              <div className="p-10 text-center text-slate-400">
                No review cycle yet — open a quarterly cycle to start certifying
                user permissions.
              </div>
            ) : loading ? (
              <div className="p-10 text-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-700/60">
                      <th className="px-4 py-2 font-semibold">User</th>
                      <th className="px-4 py-2 font-semibold">Role / Level</th>
                      <th className="px-4 py-2 font-semibold">
                        Department Permissions
                      </th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Certified by</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {rows.map((r) => (
                      <tr
                        key={r.userId}
                        className={`hover:bg-slate-700/20 ${r.certified ? "" : "bg-amber-950/10"}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-white">{r.name}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {r.username}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {r.role}
                          <span className="text-xs text-slate-500">
                            {" "}
                            · {r.level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {r.depts.length === 0 ? (
                              <span className="text-xs text-slate-500">
                                no dept perms
                              </span>
                            ) : (
                              r.depts.map((d) => (
                                <span
                                  key={d}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300"
                                >
                                  {d}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.certified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                              <CheckCircle2 className="h-3 w-3" /> CERTIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">
                              <AlertTriangle className="h-3 w-3" /> UNCERTIFIED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">
                          {r.certification
                            ? `${r.certification.certifiedBy} · ${new Date(r.certification.certifiedAt).toLocaleDateString()}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {cycle.status === "OPEN" && (
                            <Button
                              size="sm"
                              variant={r.certified ? "outline" : "primary"}
                              onClick={() => {
                                setCertFor(r);
                                setCertDepts(r.deptKeys);
                                setCertNotes("");
                              }}
                            >
                              {r.certified ? "Re-certify" : "Certify"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Uncertified users are auto-suspended (account disabled + session
            revoked) once the due date passes — each suspension is audited.
            Owners are exempt; they are above the review.
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Drills logged</div>
              <div className="text-2xl font-black text-white mt-1">
                {totals.drills ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Passed</div>
              <div className="text-2xl font-black text-emerald-300 mt-1">
                {totals.passes ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Failed / partial</div>
              <div className="text-2xl font-black text-rose-300 mt-1">
                {(totals.drills ?? 0) - (totals.passes ?? 0)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <div className="text-xs text-slate-400">Backups available</div>
              <div className="text-2xl font-black text-sky-300 mt-1">
                {backupJobs.length}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-slate-700">
              <Database className="h-4 w-4 text-sky-500" />
              <span className="text-sm font-bold text-white">
                Restore Drill Log — the proof auditors ask for
              </span>
            </div>
            {drills.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                No drills logged — run a test restore and log it here.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/40">
                {drills.map((d) => {
                  const rm = RESULT_META[d.result] || RESULT_META.PASS;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-700/20"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${rm.cls}`}
                          >
                            {d.result}
                          </span>
                          {d.backupName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(d.drillDate).toLocaleString()} · restored by{" "}
                          {d.performedBy}
                          {d.durationSec ? ` · ${d.durationSec}s` : ""}
                          {d.notes ? ` · ${d.notes}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {d.result === "PASS" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-400" />
                        )}
                        <span className="text-[10px] text-slate-500">
                          verified {new Date(d.verifiedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showCycle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowCycle(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white">
              Open Quarterly Access Review
            </h3>
            <div>
              <label className="text-xs text-slate-400">Cycle name *</label>
              <Input
                value={cycleName}
                onChange={(e) => setCycleName(e.target.value)}
                placeholder="e.g. Q3 2026 Access Review"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Due date *</label>
              <Input
                type="datetime-local"
                value={cycleDue}
                onChange={(e) => setCycleDue(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowCycle(false)}>
                Cancel
              </Button>
              <Button onClick={createCycle} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Open Cycle"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {certFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCertFor(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
              <h3 className="font-bold text-white">Certify — {certFor.name}</h3>
            </div>
            <p className="text-xs text-slate-500">
              Role: {certFor.role} · {certFor.level}. Tick the departments whose
              permissions you are certifying.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {DEPT_KEYS.map((d) => {
                const checked = certDepts.includes(d.key);
                return (
                  <label
                    key={d.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm ${checked ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200" : "bg-slate-900/40 border-slate-700 text-slate-300"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setCertDepts((prev) =>
                          prev.includes(d.key)
                            ? prev.filter((x) => x !== d.key)
                            : [...prev, d.key],
                        )
                      }
                      className="accent-emerald-500"
                    />
                    {d.label}
                  </label>
                );
              })}
            </div>
            <div>
              <label className="text-xs text-slate-400">Notes (optional)</label>
              <textarea
                value={certNotes}
                onChange={(e) => setCertNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="e.g. Access verified against org chart"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setCertFor(null)}>
                Cancel
              </Button>
              <Button
                onClick={certify}
                disabled={busy || certDepts.length === 0}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Certify (${certDepts.length} dept)`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDrill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowDrill(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white">Log Restore Drill</h3>
            <div>
              <label className="text-xs text-slate-400">
                Backup (from job list)
              </label>
              <Select
                value={drillForm.backupJobId}
                onChange={(e) =>
                  setDrillForm({ ...drillForm, backupJobId: e.target.value })
                }
              >
                <option value="">Manual entry…</option>
                {backupJobs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {new Date(b.startedAt).toLocaleString()} · SUCCESS
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Backup name / dump file *
              </label>
              <Input
                value={drillForm.backupName}
                onChange={(e) =>
                  setDrillForm({ ...drillForm, backupName: e.target.value })
                }
                placeholder="e.g. mfgmax-2026-08-11T20-00.dump"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Result *</label>
                <Select
                  value={drillForm.result}
                  onChange={(e) =>
                    setDrillForm({ ...drillForm, result: e.target.value })
                  }
                >
                  <option value="PASS">PASS</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="FAIL">FAIL</option>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Duration (sec)</label>
                <Input
                  type="number"
                  min="0"
                  value={drillForm.durationSec}
                  onChange={(e) =>
                    setDrillForm({ ...drillForm, durationSec: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Notes</label>
              <textarea
                value={drillForm.notes}
                onChange={(e) =>
                  setDrillForm({ ...drillForm, notes: e.target.value })
                }
                rows={2}
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                placeholder="Rows verified, counts matched…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowDrill(false)}>
                Cancel
              </Button>
              <Button onClick={logDrill} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Log Drill"
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
    </div>
  );
}
