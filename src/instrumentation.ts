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
  }
}
