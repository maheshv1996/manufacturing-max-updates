"use client";

import { useEffect, useRef } from "react";

/**
 * Session Activity Keeper for Industrial Workstations.
 * Automatically pings session keepalive during active operator use to prevent surprise dropouts.
 */
export default function SessionInactivityGuard() {
  const lastActivityRef = useRef<number>(Date.now());
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((ev) =>
      window.addEventListener(ev, recordActivity, { passive: true }),
    );

    // Ping /api/auth/me every 10 minutes if there was recent user activity
    keepAliveIntervalRef.current = setInterval(
      async () => {
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        if (now - lastActivityRef.current < tenMinutes) {
          try {
            await fetch("/api/auth/me", { method: "GET" });
          } catch {
            // Quiet catch
          }
        }
      },
      10 * 60 * 1000,
    );

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      if (keepAliveIntervalRef.current)
        clearInterval(keepAliveIntervalRef.current);
    };
  }, []);

  return null;
}
