"use client";

import { setServerOnline } from "./offlineSync";

export interface HealthPayload {
  ok: boolean;
  status: string;
  mode?: string;
  version?: string;
  uptimeSeconds?: number;
  db?: { ok: boolean; error?: string | null };
  disk?: { freeGb?: number; warn?: boolean } | null;
  backup?: { file?: string; at?: string } | null;
  lanIps?: string[];
}

type HealthListener = (payload: HealthPayload | null, healthy: boolean) => void;
const listeners = new Set<HealthListener>();

let lastPayload: HealthPayload | null = null;
let lastHealthy = true;
let pinger: ReturnType<typeof setInterval> | null = null;
let inflight = false;

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_INTERVAL_MS = 5000;

export function subscribeHealth(listener: HealthListener) {
  listeners.add(listener);
  listener(lastPayload, lastHealthy);
  ensurePinger();

  return () => {
    listeners.delete(listener);
    // Automatically tear down background timer when no active listeners remain
    if (listeners.size === 0 && pinger) {
      clearInterval(pinger);
      pinger = null;
    }
  };
}

export function getHealthSnapshot() {
  return { payload: lastPayload, healthy: lastHealthy };
}

export async function pingHealth(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{
  payload: HealthPayload | null;
  healthy: boolean;
}> {
  if (typeof window === "undefined") {
    return { payload: lastPayload, healthy: lastHealthy };
  }

  if (inflight) return { payload: lastPayload, healthy: lastHealthy };
  inflight = true;

  let payload: HealthPayload | null = null;
  let healthy = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch("/api/health", {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Any HTTP answer proves the server process is reachable
    if (res.ok) {
      payload = await res.json();
      healthy = Boolean(payload?.ok);
    } else if (res.status === 401 || res.status === 403) {
      healthy = true;
    }
  } catch {
    payload = null;
    healthy = false;
  } finally {
    inflight = false;
  }

  const changed = healthy !== lastHealthy;
  lastPayload = payload;
  lastHealthy = healthy;
  setServerOnline(healthy);

  if (changed) {
    listeners.forEach((fn) => {
      try {
        fn(payload, healthy);
      } catch (err) {
        console.error("Error in health listener callback:", err);
      }
    });
  }

  return { payload, healthy };
}

function ensurePinger() {
  if (typeof window === "undefined") return;
  if (pinger) return;

  pinger = setInterval(() => {
    pingHealth();
  }, DEFAULT_INTERVAL_MS);

  // Ping immediately on mount so connectivity banner status resolves without initial delay
  pingHealth();
}
