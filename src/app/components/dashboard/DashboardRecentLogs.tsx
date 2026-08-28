"use client";

import { useEffect, useState } from "react";
import { Clock, Package, StopCircle } from "lucide-react";

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
  operator?: { name: string };
}

export default function DashboardRecentLogs() {
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/logs/recent?limit=10`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && logs.length === 0)
    return (
      <div className="animate-pulse h-48 bg-slate-800/60 rounded-xl"></div>
    );
  if (logs.length === 0) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-400" />
        Recent Logs Activity
      </h3>

      <div className="space-y-3">
        {logs.map((log) => {
          const time = new Date(log.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={log.id}
              className="flex items-center justify-between p-4 bg-slate-800/60 border border-slate-700 rounded-xl"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2.5 rounded-lg ${log.type === "PRODUCTION" ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-400" : "bg-rose-100 dark:bg-rose-950/50 text-rose-400"}`}
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
                  <div className="text-sm text-slate-400">
                    {time} â€¢ {log.machine?.name} â€¢{" "}
                    {log.operator?.name || "Unknown Op"}
                    {log.status === "DRAFT" && (
                      <span className="ml-2 text-xs font-bold text-amber-500 uppercase">
                        DRAFT
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
