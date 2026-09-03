/**
 * Desktop ledger integrity sweep.
 *
 * The app server owns the scan logic (/api/finance/gl-integrity); the launcher
 * triggers it once a day through the same control-token Bearer auth the
 * update routes use. The persisted GlIntegrityRun row doubles as provenance
 * and feeds the finance-hub banner + workbench history.
 */
async function runLedgerIntegrityCheck({ baseUrl, token, log = console.log }) {
  const url = String(baseUrl).replace(/\/+$/, "") + "/api/finance/gl-integrity";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "desktop-sweep" }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        status: res.status,
        error: body.error || `HTTP ${res.status}`,
      };
    }
    const d = await res.json();
    return {
      ok: true,
      unbalanced: Number(d.unbalancedCount) || 0,
      unposted: Number(d.unpostedTotal) || 0,
      checkedAt: d.checkedAt || new Date().toISOString(),
      runId: d.run?.id || null,
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) || "fetch failed" };
  }
}

/**
 * Daily sweep at hour:minute local time (default 02:30 — quiet hours).
 * Mirrors scheduleIdempotencyPrune: a 60s tick that fires once per day and
 * never keeps the event loop alive on its own.
 */
function scheduleLedgerIntegrity({
  baseUrl,
  token,
  hour = 2,
  minute = 30,
  log = console.log,
  isServerRunning = () => true,
} = {}) {
  let timer = null;
  let lastDay = "";
  const pad = (n) => String(n).padStart(2, "0");
  const tick = async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (
      now.getHours() === hour &&
      now.getMinutes() === minute &&
      lastDay !== today &&
      isServerRunning()
    ) {
      lastDay = today;
      const res = await runLedgerIntegrityCheck({ baseUrl, token, log });
      if (!res.ok) {
        log(`[integrity] daily sweep failed: ${res.error || "unknown"}`);
      } else if (res.unbalanced > 0 || res.unposted > 0) {
        log(
          `[integrity] LEDGER ISSUES — ${res.unbalanced} unbalanced entries, ${res.unposted} unposted documents (see /finance/gl-backfill)`,
        );
      } else {
        log(`[integrity] daily sweep clean (${res.checkedAt})`);
      }
    }
  };
  timer = setInterval(tick, 60_000);
  timer.unref?.();
  log(`[integrity] daily ledger sweep scheduled for ${pad(hour)}:${pad(minute)}`);
  return {
    timer,
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
    _tick: tick, // exposed for tests — run the guard/fetch on demand
  };
}

module.exports = { runLedgerIntegrityCheck, scheduleLedgerIntegrity };
