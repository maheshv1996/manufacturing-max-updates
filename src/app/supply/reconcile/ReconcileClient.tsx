"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Edit2,
  History,
  X,
  AlertTriangle,
  Target,
} from "lucide-react";
import { getPendingQueue, removeQueueItem, QueueItem } from "@/lib/offlineSync";

interface ReconcileLog {
  id: string;
  type: "PRODUCTION" | "DOWNTIME";
  createdAt: string;
  status: string;
  goodQuantity?: number;
  scrapQuantity?: number;
  reasonId?: string;
  notes?: string;
  durationMinutes?: number;
  reason?: { id: string; description: string };
  machine?: { name: string };
  operator?: { name: string };
  workOrder?: { woNumber: string };
  adjustmentHistory?: any[];
}

export default function ReconcileClient({
  downtimeReasons,
}: {
  downtimeReasons: any[];
}) {
  const [logs, setLogs] = useState<ReconcileLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<ReconcileLog | null>(null);

  // Edit states
  const [goodQty, setGoodQty] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [, setViewHistoryLog] = useState<ReconcileLog | null>(null);

  // Plan vs Actual Shift Metrics
  const [totalGood, setTotalGood] = useState<number>(0);
  const [totalPlanned, setTotalPlanned] = useState<number>(1000);
  const [achievementPct, setAchievementPct] = useState<number>(100);
  const [targetMissed, setTargetMissed] = useState<boolean>(false);
  const [missReason, setMissReason] = useState<string>("");

  // Shift Count Disputes State
  const [disputedCounts, setDisputedCounts] = useState<any[]>([]);
  const [resolvingCount, setResolvingCount] = useState<any | null>(null);
  const [finalCountInput, setFinalCountInput] = useState<string>("");
  const [resolutionNoteInput, setResolutionNoteInput] = useState<string>("");

  // Offline Flagged Conflicts State
  const [offlineConflicts, setOfflineConflicts] = useState<QueueItem[]>([]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [res, countRes, pendingItems] = await Promise.all([
        fetch("/api/reconcile"),
        fetch("/api/shift-counts?status=DISPUTED"),
        getPendingQueue(),
      ]);

      const data = await res.json();
      const fetchedLogs: ReconcileLog[] = data.logs || [];
      setLogs(fetchedLogs);

      if (countRes.ok) {
        const countsData = await countRes.json();
        setDisputedCounts(countsData || []);
      }

      // Filter offline items flagged as conflict
      const conflicts = (pendingItems || []).filter(
        (i) => i.status === "FLAGGED_CONFLICT",
      );
      setOfflineConflicts(conflicts);

      // Compute Plan vs Actual from logs
      let goodSum = 0;
      fetchedLogs.forEach((l) => {
        if (l.type === "PRODUCTION") {
          goodSum += l.goodQuantity || 0;
        }
      });
      setTotalGood(goodSum);
      const plannedSum = 1000;
      setTotalPlanned(plannedSum);
      const pct = Number(((goodSum / plannedSum) * 100).toFixed(1));
      setAchievementPct(pct);
      setTargetMissed(pct < 95);
    } catch (e) {
      logClientError(e, "ReconcileClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleOpenResolveModal = (c: any) => {
    setResolvingCount(c);
    setFinalCountInput(String(c.inCount ?? c.outCount));
    setResolutionNoteInput(
      `Supervisor reconciled: ${Math.abs(c.outCount - (c.inCount || 0))} units variance verified.`,
    );
  };

  const handleResolveDispute = async () => {
    if (!resolvingCount || !finalCountInput) return;
    try {
      const res = await fetch("/api/shift-counts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countId: resolvingCount.id,
          finalCount: parseInt(finalCountInput, 10),
          note: resolutionNoteInput,
        }),
      });

      if (res.ok) {
        alert("WIP Count Dispute resolved successfully!");
        setResolvingCount(null);
        fetchLogs();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to resolve dispute");
      }
    } catch (e) {
      logClientError(e, "ReconcileClient");
      alert("Error resolving dispute");
    }
  };

  const handleEditClick = (log: ReconcileLog) => {
    setEditingLog(log);
    setAdjustmentReason("");
    if (log.type === "PRODUCTION") {
      setGoodQty(log.goodQuantity?.toString() || "0");
      setScrapQty(log.scrapQuantity?.toString() || "0");
    } else {
      setReasonId(log.reasonId || "");
      setDuration(log.durationMinutes?.toString() || "0");
      setNotes(log.notes || "");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;

    const data: any = { adjustmentReason };
    if (editingLog.type === "PRODUCTION") {
      data.goodQuantity = parseInt(goodQty, 10) || 0;
      data.scrapQuantity = parseInt(scrapQty, 10) || 0;
    } else {
      data.reasonId = reasonId;
      data.durationMinutes = parseInt(duration, 10) || 0;
      data.notes = notes;
    }

    try {
      const res = await fetch("/api/reconcile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: editingLog.id,
          type: editingLog.type,
          data,
        }),
      });
      if (res.ok) {
        setEditingLog(null);
        fetchLogs();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update log");
      }
    } catch (e) {
      logClientError(e, "ReconcileClient");
      alert("Error updating log");
    }
  };

  const handleCloseShift = async () => {
    if (targetMissed && (!missReason || !missReason.trim())) {
      alert(
        "Shift target was missed (< 95% of plan). A 'Why did we miss plan?' reason is MANDATORY to close the shift.",
      );
      return;
    }

    if (
      !confirm(
        "Are you sure you want to finalize all draft logs? They will no longer be editable by operators.",
      )
    )
      return;

    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logIds: logs.map((l) => l.id),
          type: "ALL",
          missReason: missReason.trim(),
          targetMissed,
        }),
      });
      if (res.ok) {
        alert("Shift closed and all logs finalized successfully!");
        setMissReason("");
        fetchLogs();
      } else {
        alert("Failed to close shift");
      }
    } catch (e) {
      alert("Error closing shift");
    }
  };

  return (
    <div className="space-y-6">
      {/* PLAN VS ACTUAL SHIFT RECONCILIATION CARD */}
      <div
        className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          targetMissed
            ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            <h3 className="font-extrabold text-base uppercase tracking-wider">
              Shift Production Target Reconciliation
            </h3>
          </div>
          <p className="text-xs opacity-90 font-mono">
            Planned Output: <strong>{totalPlanned.toLocaleString()} pcs</strong>{" "}
            | Reconciled Good Logged:{" "}
            <strong>{totalGood.toLocaleString()} pcs</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xl font-black font-mono">
              {achievementPct}%
            </span>
            <span className="text-[10px] block opacity-75 uppercase">
              Achievement Rate
            </span>
          </div>

          <span
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border shadow-md ${
              targetMissed
                ? "bg-rose-600 text-white border-rose-500"
                : "bg-emerald-600 text-white border-emerald-500"
            }`}
          >
            {targetMissed ? "Target Missed ⚠️" : "Target Met ✓"}
          </span>
        </div>
      </div>

      {/* MANDATORY MISS REASON FIELD IN RECONCILIATION */}
      {targetMissed && (
        <div className="p-4 bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl space-y-2">
          <label className="block text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            Why did we miss plan? (Mandatory Reason to Close Shift) *
          </label>
          <p className="text-xs text-rose-300">
            Current reconciled good output ({totalGood} pcs) is below the 95%
            target threshold of planned output ({totalPlanned} pcs). Supervisor
            must specify a miss reason before finalizing.
          </p>
          <textarea
            required
            rows={2}
            value={missReason}
            onChange={(e) => setMissReason(e.target.value)}
            placeholder="e.g. Die broke at 3 PM, Unplanned electrical failure on Line 2..."
            className="w-full bg-slate-900 border border-rose-500/50 rounded-xl p-3 text-sm text-white font-medium focus:outline-none focus:border-rose-400"
          />
        </div>
      )}

      {/* SHIFT WIP HANDOFF COUNT DISPUTES SECTION */}
      {disputedCounts.length > 0 && (
        <div className="bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Active Shift WIP Count Disputes ({disputedCounts.length})
            </h3>
            <span className="text-xs text-rose-300 font-mono font-bold">
              Requires Supervisor Action
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disputedCounts.map((c) => {
              const delta = Math.abs(c.outCount - (c.inCount || 0));
              return (
                <div
                  key={c.id}
                  className="bg-slate-900 border border-rose-500/30 rounded-xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-bold text-white text-sm">
                      📍 {c.machine?.name}
                    </span>
                    <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-black uppercase">
                      Delta: {delta} pcs
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">
                        Outgoing ({c.outgoingUser?.name || "Op 1"})
                      </span>
                      <strong className="text-purple-400 text-sm">
                        {c.outCount} units
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">
                        Incoming ({c.incomingUser?.name || "Op 2"})
                      </span>
                      <strong className="text-rose-400 text-sm">
                        {c.inCount ?? "—"} units
                      </strong>
                    </div>
                  </div>

                  {c.note && (
                    <p className="text-xs text-slate-300 italic bg-slate-950/50 p-2 rounded border border-slate-800">
                      {c.note}
                    </p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleOpenResolveModal(c)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-md cursor-pointer transition-all"
                    >
                      Resolve Dispute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {offlineConflicts.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Flagged Offline State Conflicts ({offlineConflicts.length})
            </h3>
            <span className="text-xs text-amber-300 font-mono font-bold">
              State Locking Audit
            </span>
          </div>

          <div className="space-y-3">
            {offlineConflicts.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black font-mono rounded">
                      {item.method} {item.endpoint}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Client Time:{" "}
                      {new Date(item.clientTimestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200 font-semibold">
                    {item.conflictReason ||
                      "State Conflict: Machine/WO status modified by another terminal during offline window."}
                  </p>
                </div>

                <button
                  onClick={async () => {
                    await removeQueueItem(item.id);
                    setOfflineConflicts((prev) =>
                      prev.filter((i) => i.id !== item.id),
                    );
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
                >
                  Acknowledge & Dismiss Audit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">
          Active Drafts ({logs.length})
        </h2>
        <button
          onClick={handleCloseShift}
          disabled={logs.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5" />
          Close Shift (Finalize All)
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse h-64 bg-slate-800/60 border border-slate-700 rounded-xl"></div>
      ) : logs.length === 0 ? (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Draft Logs</h3>
          <p className="text-slate-400">
            All logs have been finalized for this shift.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/60 text-slate-400 font-medium border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Machine</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          log.type === "PRODUCTION"
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-300"
                            : "bg-rose-100 dark:bg-rose-900/40 text-rose-300"
                        }`}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      {log.machine?.name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {log.type === "PRODUCTION" ? (
                        <div className="space-y-0.5">
                          <span className="font-mono text-emerald-400 font-bold">
                            {log.goodQuantity} good
                          </span>
                          {log.scrapQuantity ? (
                            <span className="font-mono text-rose-500 ml-2">
                              ({log.scrapQuantity} scrap)
                            </span>
                          ) : null}
                          <span className="block text-xs text-slate-400">
                            WO: {log.workOrder?.woNumber || "N/A"}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-200">
                            {log.reason?.description || "Unclassified"}
                          </span>
                          <span className="block text-xs font-mono text-rose-500 font-bold">
                            {log.durationMinutes} mins
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEditClick(log)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Adjust Log"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {log.adjustmentHistory &&
                        log.adjustmentHistory.length > 0 && (
                          <button
                            onClick={() => setViewHistoryLog(log)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 hover:bg-purple-900/30 rounded-lg transition-colors"
                            title="View Adjustment Audit Trail"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <h3 className="text-lg font-bold text-white">
                Reconcile {editingLog.type} Log
              </h3>
              <button
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {editingLog.type === "PRODUCTION" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Good Quantity
                    </label>
                    <input
                      type="number"
                      value={goodQty}
                      onChange={(e) => setGoodQty(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Scrap Quantity
                    </label>
                    <input
                      type="number"
                      value={scrapQty}
                      onChange={(e) => setScrapQty(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Downtime Reason
                    </label>
                    <select
                      value={reasonId}
                      onChange={(e) => setReasonId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select Reason...</option>
                      {downtimeReasons.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Audit Adjustment Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Count discrepancy verified by Supervisor"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-md"
              >
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE DISPUTE MODAL */}
      {resolvingCount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Resolve WIP Count Dispute
              </h3>
              <button
                onClick={() => setResolvingCount(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>
                <strong>Machine:</strong> {resolvingCount.machine?.name}
              </div>
              <div>
                <strong>
                  Outgoing Count ({resolvingCount.outgoingUser?.name || "Op 1"}
                  ):
                </strong>{" "}
                {resolvingCount.outCount} units
              </div>
              <div>
                <strong>
                  Incoming Count ({resolvingCount.incomingUser?.name || "Op 2"}
                  ):
                </strong>{" "}
                {resolvingCount.inCount ?? "—"} units
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase mb-1">
                  Final Agreed WIP Count *
                </label>
                <input
                  type="number"
                  required
                  value={finalCountInput}
                  onChange={(e) => setFinalCountInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase mb-1">
                  Supervisor Resolution Note *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Scrapped 10 units at end of shift; final count agreed at 440."
                  value={resolutionNoteInput}
                  onChange={(e) => setResolutionNoteInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setResolvingCount(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveDispute}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg shadow-md cursor-pointer"
              >
                Save Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
