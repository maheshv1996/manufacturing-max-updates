/**
 * C8-9c — Machine FAULT/DOWN → BREAKDOWN job detection (W11: "breakdowns create
 * jobs from machine DOWN events (Andon)"). Pure — given the live machine set and
 * their open-breakdown state, decide which machines need a BREAKDOWN job created.
 * A machine is a candidate only when it is in a fault state, has no OPEN /
 * IN_PROGRESS BREAKDOWN job, and (optionally) its last closed breakdown is older
 * than the cooldown window — so a persistence loop cannot spam duplicates.
 */

export interface BreakdownScanInput {
  machineId: string;
  name?: string;
  /** currentState === "FAULT" (IoT/Andon) or status === "DOWN". */
  faultState: boolean;
  /** true when an OPEN or IN_PROGRESS BREAKDOWN job already exists for the machine. */
  hasOpenBreakdown: boolean;
  /** When the most recent BREAKDOWN job for the machine was closed (null = none). */
  lastBreakdownClosedAt?: Date | null;
}

export interface BreakdownScanOptions {
  now?: Date;
  /** Re-open guard in minutes; null/0 = no guard (default). */
  cooldownMinutes?: number;
}

export interface BreakdownScanResult {
  candidates: Array<{ machineId: string; name?: string }>;
  machineIds: string[];
}

export function detectBreakdownMachines(
  machines: BreakdownScanInput[],
  opts: BreakdownScanOptions = {},
): BreakdownScanResult {
  const now = opts.now ?? new Date();
  const cooldownMs = (opts.cooldownMinutes ?? 0) * 60 * 1000;

  const candidates: Array<{ machineId: string; name?: string }> = [];
  for (const m of machines) {
    if (!m.faultState) continue;
    if (m.hasOpenBreakdown) continue;
    if (cooldownMs > 0 && m.lastBreakdownClosedAt) {
      const since = now.getTime() - m.lastBreakdownClosedAt.getTime();
      if (since < cooldownMs) continue;
    }
    candidates.push({ machineId: m.machineId, name: m.name });
  }

  return { candidates, machineIds: candidates.map((c) => c.machineId) };
}