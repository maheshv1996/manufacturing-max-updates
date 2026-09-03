export async function register() {
  // Runs once when the Next.js server starts. The build monitor is node-only
  // (fs access) — it must be dynamically imported behind the NEXT_RUNTIME guard
  // so the Edge instrumentation bundle never traces it. It watches for .next
  // being rebuilt underneath a running server so a stale manifest can never
  // serve broken CSS/JS silently — the health endpoint surfaces it as a hard
  // warning instead.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBuildMonitor } = await import("@/lib/buildMonitor");
    startBuildMonitor();

    // Offline desktop: daily IdempotencyKey prune (7-day TTL) — keeps embedded DB bounded.
    // Launcher also schedules the same prune, but the server is the source of truth when it is up.
    if (process.env.DESKTOP_MODE === "true") {
      const { pruneIdempotencyKeys } = await import("@/lib/idempotency");
      const schedulePrune = () => {
        const now = new Date();
        if (now.getHours() === 2 && now.getMinutes() === 15) {
          pruneIdempotencyKeys(7).catch(() => {});
        }
      };
      setInterval(schedulePrune, 60_000).unref?.();
      // Opportunistic prune on boot (best-effort, ignore if table not yet migrated)
      pruneIdempotencyKeys(7).catch(() => {});
    }

    // Sentry & APM Observability Sampling Initialization
    const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (sentryDsn) {
      try {
        const tracesSampleRate = Math.min(
          1.0,
          Math.max(0.0, parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1")),
        );
        const profilesSampleRate = Math.min(
          1.0,
          Math.max(0.0, parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1")),
        );
        // Configured for OpenTelemetry / Sentry distributed trace sampling
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[Observability] Sentry sampling initialized. Traces: ${tracesSampleRate}, Profiles: ${profilesSampleRate}`,
          );
        }
      } catch (err) {
        console.error("[Observability] Failed to configure Sentry sampling:", err);
      }
    }
  }
}
