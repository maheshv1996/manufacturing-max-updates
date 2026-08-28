"use client";

import { useEffect, useState } from "react";
import { subscribeHealth, type HealthPayload } from "@/lib/health";
import { WifiOff, RefreshCw } from "lucide-react";

export default function ServerHealthBanner() {
  const [unreachable, setUnreachable] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const unsub = subscribeHealth(
      (_payload: HealthPayload | null, healthy: boolean) => {
        setUnreachable(!healthy);
        setRetrying(false);
      },
    );
    return unsub;
  }, []);

  if (!unreachable) return null;

  return (
    <div
      role="alert"
      className="no-print fixed top-14 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md px-4"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-950/90 backdrop-blur-md text-amber-200 shadow-modal">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm font-medium flex-1">
          Server unreachable — retrying
        </p>
        <span className="flex items-center gap-1.5 text-xs text-amber-300/80">
          <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
          actions queued offline
        </span>
      </div>
    </div>
  );
}
