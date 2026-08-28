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

export function subscribeHealth(listener: HealthListener) {
  listeners.add(listener);
  listener(lastPayload, lastHealthy);
  ensurePinger();
  return () => {
    listeners.delete(listener);
  };
}

export function getHealthSnapshot() {
  return { payload: lastPayload, healthy: lastHealthy };
}

export async function pingHealth(): Promise<{
  payload: HealthPayload | null;
  healthy: boolean;
}> {
  if (inflight) return { payload: lastPayload, healthy: lastHealthy };
  inflight = true;
  let payload: HealthPayload | null = null;
  let healthy = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("/api/health", {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    // Any HTTP answer proves the server is REACHABLE — including 401/403
    // (auth is a separate concern; the banner exists to catch dead servers,
    // and a logged-out visitor would otherwise see a false "unreachable").
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
    listeners.forEach((fn) => fn(payload, healthy));
  }
  return { payload, healthy };
}

function ensurePinger() {
  if (pinger) return;
  pinger = setInterval(() => {
    pingHealth();
  }, 5000);
  // Ping once immediately so the banner resolves fast on first paint.
  pingHealth();
}
