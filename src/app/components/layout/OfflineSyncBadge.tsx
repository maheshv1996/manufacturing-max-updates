"use client";

import { useState, useEffect } from "react";
import { subscribeSyncStatus, SyncStatus, drainQueue } from "@/lib/offlineSync";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";

export default function OfflineSyncBadge() {
  const [status, setStatus] = useState<SyncStatus>("ONLINE");
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((st, count) => {
      setStatus(st);
      setPendingCount(count);
    });
    return () => unsubscribe();
  }, []);

  const handleManualRetry = async () => {
    setIsManualSyncing(true);
    await drainQueue();
    setIsManualSyncing(false);
  };

  if (status === "ONLINE" && pendingCount === 0) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-extrabold shadow-sm transition-all"
        title="Factory Wi-Fi Connected & System In Sync"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <Wifi className="w-3.5 h-3.5" />
        <span>Online</span>
      </div>
    );
  }

  if (status === "OFFLINE") {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 dark:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-full text-xs font-black shadow-sm animate-pulse transition-all"
        title="Network disconnected. Logs are being saved locally in Offline Queue."
      >
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline: Saving locally ({pendingCount})</span>
      </div>
    );
  }

  if (status === "SYNCING") {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/15 dark:bg-blue-500/25 text-blue-300 border border-blue-500/40 rounded-full text-xs font-black shadow-sm transition-all"
        title="Reconnected to network. Draining offline queue."
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
        <span>Syncing ({pendingCount} pending)</span>
      </div>
    );
  }

  // FAILED STATUS
  return (
    <div className="inline-flex items-center gap-2">
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/15 dark:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-full text-xs font-black shadow-sm"
        title="Sync retries failed. Click Retry to attempt synchronization again."
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
        <span>Sync Failed ({pendingCount})</span>
      </div>
      <button
        onClick={handleManualRetry}
        disabled={isManualSyncing}
        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-bold shadow transition-colors flex items-center gap-1"
      >
        <RefreshCw
          className={`w-3 h-3 ${isManualSyncing ? "animate-spin" : ""}`}
        />
        Retry
      </button>
    </div>
  );
}
