"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState } from "react";
import { Clock, Edit2, Package, StopCircle, X } from "lucide-react";
import { offlineFetchWrapper } from "@/lib/offlineSync";

interface RecentLog {
  id: string;
  type: "PRODUCTION" | "DOWNTIME";
  createdAt: string;
  status: string;
  goodQuantity?: number;
  scrapQuantity?: number;
  reasonId?: string;
  notes?: string;
  reason?: { id: string; description: string };
  machine?: { name: string };
  durationMinutes?: number;
}

export default function OperatorRecentLogs({
  operatorId,
  downtimeReasons,
  onEditComplete,
}: {
  operatorId: string;
  downtimeReasons: any[];
  onEditComplete: () => void;
}) {
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<RecentLog | null>(null);

  // Form states
  const [goodQty, setGoodQty] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");

  const fetchLogs = async () => {
    try {
      const res = await fetch(
        `/api/logs/recent?operatorId=${operatorId}&limit=5`,
      );
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      logClientError(e, "OperatorRecentLogs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId]);

  const canEdit = (log: RecentLog) => {
    if (log.status !== "DRAFT") return false;
    const ageMs = Date.now() - new Date(log.createdAt).getTime();
    return ageMs <= 15 * 60 * 1000;
  };

  const handleEditClick = (log: RecentLog) => {
    setEditingLog(log);
    if (log.type === "PRODUCTION") {
      setGoodQty(log.goodQuantity?.toString() || "0");
      setScrapQty(log.scrapQuantity?.toString() || "0");
    } else {
      setReasonId(log.reasonId || "");
      setNotes(log.notes || "");
    }
  };

  const handleSave = async () => {
    if (!editingLog) return;

    let data = {};
    if (editingLog.type === "PRODUCTION") {
      data = {
        goodQuantity: parseInt(goodQty, 10) || 0,
        scrapQuantity: parseInt(scrapQty, 10) || 0,
      };
    } else {
      data = { reasonId, notes };
    }

    try {
      const res = await offlineFetchWrapper("/api/logs/operator-edit", {
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
        onEditComplete();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update log");
      }
    } catch (e) {
      logClientError(e, "OperatorRecentLogs");
      alert("Error updating log");
    }
  };

  if (loading && logs.length === 0)
    return <div className="animate-pulse h-24 bg-slate-800 rounded-3xl"></div>;
  if (logs.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
      <h3 className="text-lg font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-400" />
        Recent Activity
      </h3>

      <div className="space-y-3">
        {logs.map((log) => {
          const isEditable = canEdit(log);
          const time = new Date(log.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={log.id}
              className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2.5 rounded-xl ${log.type === "PRODUCTION" ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"}`}
                >
                  {log.type === "PRODUCTION" ? (
                    <Package className="w-5 h-5" />
                  ) : (
                    <StopCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-slate-200 font-bold">
                    {log.type === "PRODUCTION"
                      ? `Logged: ${log.goodQuantity} Good, ${log.scrapQuantity} Scrap`
                      : `Downtime: ${log.reason?.description || "Uncategorized"}`}
                  </div>
                  <div className="text-sm text-slate-400 font-mono">
                    {time} • {log.machine?.name}{" "}
                    {log.status === "DRAFT" ? "• (DRAFT)" : ""}
                  </div>
                </div>
              </div>

              {isEditable && (
                <button
                  onClick={() => handleEditClick(log)}
                  className="p-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl transition-colors cursor-pointer"
                  title="Edit log (within 15 mins)"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editingLog && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                Edit{" "}
                {editingLog.type === "PRODUCTION" ? "Production" : "Downtime"}{" "}
                Log
              </h3>
              <button
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X />
              </button>
            </div>

            {editingLog.type === "PRODUCTION" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2 font-bold">
                    Good Quantity
                  </label>
                  <input
                    type="number"
                    value={goodQty}
                    onChange={(e) => setGoodQty(e.target.value)}
                    className="w-full bg-slate-800 p-4 rounded-xl focus:outline-none text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2 font-bold">
                    Scrap Quantity
                  </label>
                  <input
                    type="number"
                    value={scrapQty}
                    onChange={(e) => setScrapQty(e.target.value)}
                    className="w-full bg-slate-800 p-4 rounded-xl focus:outline-none text-white font-bold"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2 font-bold">
                    Downtime Reason
                  </label>
                  <select
                    value={reasonId}
                    onChange={(e) => setReasonId(e.target.value)}
                    className="w-full bg-slate-800 p-4 rounded-xl focus:outline-none text-white font-bold"
                  >
                    <option value="">Select reason...</option>
                    {downtimeReasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2 font-bold">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-800 p-4 rounded-xl focus:outline-none text-white"
                  />
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 bg-slate-800 p-4 rounded-xl font-bold text-white hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
