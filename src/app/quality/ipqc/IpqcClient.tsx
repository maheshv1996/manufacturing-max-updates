"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/app/components/ui";

interface CheckResult {
  id: string;
  characteristic: string;
  processStep: string | null;
  specMin: number | null;
  specMax: number | null;
  measurementMethod: string | null;
  sampleSize: number | null;
  frequency: string | null;
  controlMethod: string | null;
  measuredValue: number | null;
  valueText: string | null;
  result: string;
  comment: string | null;
  recordedBy: string | null;
}

interface Run {
  id: string;
  runNumber: string;
  status: string;
  failedCount: number;
  processStep: string | null;
  startedAt: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  workOrder: { woNumber: string; product: { name: string } } | null;
  machine: { name: string; code: string } | null;
  operator: { name: string; employeeNumber: string | null } | null;
  ncr: { ncrNumber: string; status: string } | null;
  checks: CheckResult[];
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  PASSED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  FAILED: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  REVIEWED: "bg-violet-500/15 text-violet-300 border-violet-500/40",
};

export default function IpqcClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/ipcc");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const openCount = runs.filter((r) => r.status === "OPEN").length;
  const failedPending = runs.filter((r) => r.status === "FAILED").length;
  const anomalies = runs.flatMap((r) =>
    r.checks
      .filter((c) => c.result === "FAIL")
      .map((c) => ({ run: r, check: c })),
  );

  const doReview = async (id: string) => {
    setMsg("");
    if (!reason.trim()) {
      setMsg("A review reason is required (audit trail).");
      return;
    }
    setReviewingId(id);
    try {
      const res = await fetch("/api/ipcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          data: { id, reason: reason.trim() },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Run reviewed — SPC anomaly acknowledged.`);
        setReason("");
        await fetchRuns();
      } else {
        setMsg(data.error || "Review failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Checklists run",
            value: runs.length,
            icon: <ClipboardCheck className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Open right now",
            value: openCount,
            icon: <Loader2 className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "Failed → review",
            value: failedPending,
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: failedPending ? "text-rose-500" : undefined,
          },
          {
            label: "SPC anomalies",
            value: anomalies.length,
            icon: <ShieldCheck className="h-5 w-5 text-violet-500" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3"
          >
            {k.icon}
            <div>
              <p className="text-2xl font-black text-white">{k.value}</p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* SPC anomalies queue */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-violet-400" /> SPC Anomalies
          Queue
        </h3>
        {anomalies.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No out-of-spec measurements — the process is in control.
          </p>
        ) : (
          anomalies.map(({ run, check }) => (
            <div
              key={check.id}
              className="rounded-2xl bg-slate-800/60 border border-rose-500/30 p-4 space-y-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-rose-300">
                    {run.runNumber}
                  </span>
                  <span className="text-sm text-slate-300">
                    {run.workOrder?.woNumber} · {run.workOrder?.product?.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {run.machine?.code}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_STYLE[run.status]}`}
                >
                  {run.status}
                </span>
              </div>
              <p className="text-sm text-white">
                {check.processStep && (
                  <span className="text-slate-400">{check.processStep} — </span>
                )}
                <span className="font-semibold">{check.characteristic}</span> ={" "}
                {check.measuredValue ?? check.valueText} (spec{" "}
                {check.specMin ?? "—"} – {check.specMax ?? "—"})
                {check.measurementMethod && (
                  <span className="text-slate-400">
                    {" "}
                    · {check.measurementMethod}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-400">
                Recorded by{" "}
                {check.recordedBy || run.operator?.name || "operator"} ·{" "}
                {run.operator?.employeeNumber || ""}
              </p>
              {run.ncr && (
                <p className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Auto NCR:{" "}
                  {run.ncr.ncrNumber} ({run.ncr.status})
                </p>
              )}
              {run.status === "FAILED" && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Review note (audit trail)…"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-400"
                  />
                  <Button
                    onClick={() => doReview(run.id)}
                    disabled={reviewingId === run.id}
                    variant="outline"
                    size="sm"
                  >
                    {reviewingId === run.id
                      ? "Reviewing…"
                      : "Acknowledge & Review"}
                  </Button>
                </div>
              )}
              {run.reviewedBy && (
                <p className="text-xs text-violet-300">
                  Reviewed by {run.reviewedBy} — {run.reviewNote}
                </p>
              )}
            </div>
          ))
        )}
      </section>

      {/* All runs */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white">All Checklist Runs</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No IPQC checklists yet — operators run them from the terminal when a
            job is in progress (checks come from the approved Control Plan).
          </p>
        ) : (
          runs.map((run) => (
            <details
              key={run.id}
              className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 group"
            >
              <summary className="cursor-pointer flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${run.status === "PASSED" ? "bg-emerald-400" : run.status === "FAILED" ? "bg-rose-400" : run.status === "REVIEWED" ? "bg-violet-400" : "bg-sky-400"}`}
                  />
                  <span className="font-bold text-white">{run.runNumber}</span>
                  <span className="text-sm text-slate-300">
                    {run.workOrder?.woNumber} · {run.machine?.code}
                  </span>
                  <span className="text-xs text-slate-400">
                    {run.operator?.name}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_STYLE[run.status]}`}
                >
                  {run.status}
                  {run.failedCount > 0 ? ` · ${run.failedCount} failed` : ""}
                </span>
              </summary>
              <div className="mt-3 space-y-2">
                {run.checks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">
                        {c.characteristic}
                      </p>
                      <p className="text-xs text-slate-400">
                        {c.processStep || ""} · spec {c.specMin ?? "—"}–
                        {c.specMax ?? "—"} · {c.measurementMethod || "visual"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-mono text-white">
                        {c.measuredValue ?? c.valueText ?? "—"}
                      </span>
                      {c.result === "PASS" ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                        </span>
                      ) : c.result === "FAIL" ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5" /> FAIL
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">PENDING</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
