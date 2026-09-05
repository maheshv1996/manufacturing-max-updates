/**
 * C8-2 — PM rule evaluation (W11: "PM: PMRule (by run-hours/cycles/calendar) → job").
 * Pure — the caller supplies run-hours since last PM (from machine telemetry/logs);
 * the engine only decides due/not-due and why.
 */

export interface PmRuleInput {
  id: string;
  machineId: string;
  title: string;
  intervalDays?: number | null;
  intervalRunHours?: number | null;
  lastDoneAt?: Date | null;
  isActive?: boolean;
}

export type PmDueReason = "NEVER_DONE" | "CALENDAR" | "RUN_HOURS";

export interface PmDueResult {
  due: boolean;
  reason?: PmDueReason;
  /** Days past the calendar interval (calendar trigger only). */
  overdueDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluatePmDue(
  rule: PmRuleInput,
  ctx: { now: Date; runHoursSinceLast?: number | null },
): PmDueResult {
  if (rule.isActive === false) return { due: false };

  if (!rule.lastDoneAt) return { due: true, reason: "NEVER_DONE" };

  if (rule.intervalDays && rule.intervalDays > 0) {
    const elapsedDays = (ctx.now.getTime() - rule.lastDoneAt.getTime()) / DAY_MS;
    if (elapsedDays >= rule.intervalDays) {
      return { due: true, reason: "CALENDAR", overdueDays: Math.floor(elapsedDays - rule.intervalDays) };
    }
  }

  if (rule.intervalRunHours && rule.intervalRunHours > 0) {
    const sinceLast = ctx.runHoursSinceLast;
    if (typeof sinceLast === "number" && sinceLast >= rule.intervalRunHours) {
      return { due: true, reason: "RUN_HOURS" };
    }
  }

  return { due: false };
}

/** Convenience: scan a rule set and return the due ones with their reasons. */
export function scanPmRules(
  rules: PmRuleInput[],
  ctx: { now: Date; runHoursByMachine?: Map<string, number> },
): { machineId: string; ruleId: string; title: string; reason: PmDueReason; overdueDays?: number }[] {
  const due: { machineId: string; ruleId: string; title: string; reason: PmDueReason; overdueDays?: number }[] = [];
  for (const rule of rules) {
    const r = evaluatePmDue(rule, {
      now: ctx.now,
      runHoursSinceLast: ctx.runHoursByMachine?.get(rule.machineId) ?? null,
    });
    if (r.due && r.reason) {
      due.push({
        machineId: rule.machineId,
        ruleId: rule.id,
        title: rule.title,
        reason: r.reason,
        overdueDays: r.overdueDays,
      });
    }
  }
  return due;
}
