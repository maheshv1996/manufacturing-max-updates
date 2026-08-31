import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Build Monitor — guards against stale server processes serving outdated assets
 * after an in-place rebuild. Exposes real-time health telemetry for /system/health.
 */

let bootBuildId: string | null = null;
let staleDetected = false;
let staleSince: number | null = null;
let pollCount = 0;
let lastCheckedAt: number | null = null;
let activeTimer: NodeJS.Timeout | null = null;

function buildIdPath(): string {
  return join(process.cwd(), ".next", "BUILD_ID");
}

export function currentBuildId(): string | null {
  try {
    const p = buildIdPath();
    if (!existsSync(p)) return null;
    const id = readFileSync(p, "utf8").trim();
    return id || null;
  } catch {
    return null;
  }
}

export function resetBuildMonitor(): void {
  staleDetected = false;
  staleSince = null;
  bootBuildId = currentBuildId();
}

export function acknowledgeStaleBuild(newBuildId?: string): void {
  bootBuildId = newBuildId || currentBuildId() || bootBuildId;
  staleDetected = false;
  staleSince = null;
}

export function getBuildMonitor() {
  const current = currentBuildId();
  return {
    bootBuildId,
    currentBuildId: current,
    stale: staleDetected,
    staleSince: staleSince ? new Date(staleSince).toISOString() : null,
    pollCount,
    lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null,
    isHealthy: !staleDetected,
  };
}

export function startBuildMonitor(): () => void {
  // Idempotent initialization: preserve bootBuildId if already captured
  if (!bootBuildId) {
    bootBuildId = currentBuildId();
  }

  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }

  const rawInterval = Number(process.env.BUILD_MONITOR_INTERVAL_MS);
  const intervalMs = !isNaN(rawInterval) && rawInterval > 0 ? Math.max(1000, rawInterval) : 30_000;

  const check = () => {
    lastCheckedAt = Date.now();
    pollCount = (pollCount + 1) % 1_000_000;

    const current = currentBuildId();

    // If bootBuildId was not available at cold boot (dev start), hydrate it once written
    if (!bootBuildId && current) {
      bootBuildId = current;
      return;
    }

    if (staleDetected) return;

    if (bootBuildId && current && current !== bootBuildId) {
      staleDetected = true;
      staleSince = Date.now();
      console.warn(
        `[build-monitor] ⚠️ STALE BUILD DETECTED: .next was rebuilt (${bootBuildId} → ${current}) while the server process was running. Assets may 404. Live health alert triggered.`,
      );
    }
  };

  activeTimer = setInterval(check, intervalMs);
  activeTimer.unref?.();

  return () => {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
  };
}
