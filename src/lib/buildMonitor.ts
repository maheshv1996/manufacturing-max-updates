import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Build monitor — guards against the "stale server" failure mode where a
 * production server keeps serving an old manifest (and its old asset hashes)
 * after `.next` is rebuilt underneath it. That silently 500s the main CSS/JS
 * chunks and the whole app renders unstyled.
 *
 * `register()` (in instrumentation.ts) snapshots the BUILD_ID the server booted
 * with and polls for changes. The health endpoint exposes the state so
 * `/system/health` can show a hard red banner instead of a broken UI.
 */

let bootBuildId: string | null = null;
let staleDetected = false;
let staleSince: number | null = null;

function buildIdPath(): string {
  return join(process.cwd(), ".next", "BUILD_ID");
}

export function currentBuildId(): string | null {
  try {
    if (!existsSync(buildIdPath())) return null;
    const id = readFileSync(buildIdPath(), "utf8").trim();
    return id || null;
  } catch {
    return null;
  }
}

export function getBuildMonitor() {
  return {
    bootBuildId,
    stale: staleDetected,
    staleSince: staleSince ? new Date(staleSince).toISOString() : null,
    currentBuildId: currentBuildId(),
  };
}

export function startBuildMonitor(): () => void {
  bootBuildId = currentBuildId();

  const check = () => {
    if (staleDetected) return;
    const current = currentBuildId();
    if (bootBuildId && current && current !== bootBuildId) {
      staleDetected = true;
      staleSince = Date.now();
      // eslint-disable-next-line no-console
      console.error(
        `[build-monitor] ⚠️ STALE BUILD DETECTED: .next was rebuilt (${bootBuildId} → ${current}) ` +
          `while this server is running. The server is serving a stale manifest — CSS/JS assets ` +
          `may 404 and the app can render unstyled. RESTART REQUIRED.`,
      );
    }
  };

  const timer = setInterval(check, 30_000);
  timer.unref?.();
  return () => clearInterval(timer);
}
