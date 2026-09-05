/**
 * C8-4 — Calibration / metrology gate (W11, guardrail G-4: no expired instrument
 * measuring). Semantics seeded from v1 `src/lib/calibration.ts` (30-day warning,
 * expired ⇒ effective quarantine, O(1) interval math), re-typed for v2 with the
 * issue/measurement decision layer the shop floor and cal lab both consume.
 * Pure — no DB.
 */

import { ok, err, type Result } from "../core/result";

export type CalibrationStatus = "OK" | "EXPIRING_SOON" | "EXPIRED";
export type InstrumentLocation = "LAB_CABINET" | "WITH_OPERATOR" | "SHOPFLOOR" | "QUARANTINE";
export type InstrumentLifecycle = "PROCUREMENT" | "ACTIVE" | "RETIRED";

export const CALIBRATION_WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface InstrumentInput {
  id: string;
  serialNumber: string;
  calibratedAt: Date;
  expiresAt: Date | null;
  location: InstrumentLocation;
  lifecycle: InstrumentLifecycle;
}

export function daysUntilExpiry(inst: Pick<InstrumentInput, "expiresAt">, now: Date): number {
  if (!inst.expiresAt) return 0;
  const days = Math.round((inst.expiresAt.getTime() - now.getTime()) / DAY_MS);
  return days === 0 ? 0 : days; // normalize -0
}

export function calibrationStatus(inst: Pick<InstrumentInput, "expiresAt">, now: Date): CalibrationStatus {
  if (!inst.expiresAt) return "EXPIRED";
  const days = daysUntilExpiry(inst, now);
  if (days <= 0) return "EXPIRED";
  if (days <= CALIBRATION_WARNING_DAYS) return "EXPIRING_SOON";
  return "OK";
}

/**
 * Where the instrument effectively is. RETIRED leaves circulation; an expired
 * instrument is auto-quarantined (the cage) regardless of the recorded location,
 * per ISO/IEC 17025 practice — it cannot be issued until recalibrated.
 */
export function effectiveInstrumentLocation(
  inst: InstrumentInput,
  now: Date,
): InstrumentLocation | "RETIRED" {
  if (inst.lifecycle === "RETIRED") return "RETIRED";
  if (calibrationStatus(inst, now) === "EXPIRED") return "QUARANTINE";
  return inst.location;
}

export type MeasurementRefusal =
  | { ok: true }
  | { ok: false; reason: "EXPIRED" | "RETIRED" | "NOT_ACTIVE" | "QUARANTINED" };

/** G-4 — may this instrument be used for measurement right now? */
export function canMeasure(inst: InstrumentInput, now: Date): MeasurementRefusal {
  if (inst.lifecycle === "RETIRED") return { ok: false, reason: "RETIRED" };
  if (inst.lifecycle !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (calibrationStatus(inst, now) === "EXPIRED") return { ok: false, reason: "EXPIRED" };
  if (inst.location === "QUARANTINE") return { ok: false, reason: "QUARANTINED" };
  return { ok: true };
}

export type IssueRefusal =
  | { ok: true }
  | { ok: false; reason: "EXPIRED" | "RETIRED" | "NOT_ACTIVE" | "QUARANTINED" | "ALREADY_ISSUED" | "INVALID_RETURN" };

/** May the crib issue this instrument to an operator? */
export function canIssue(
  inst: InstrumentInput,
  now: Date,
  expectedReturnAt: Date,
): MeasurementRefusal | { ok: false; reason: "ALREADY_ISSUED" | "INVALID_RETURN" } {
  if (expectedReturnAt.getTime() <= now.getTime()) return { ok: false, reason: "INVALID_RETURN" };
  if (inst.location === "WITH_OPERATOR") return { ok: false, reason: "ALREADY_ISSUED" };

  const base = canMeasure(inst, now);
  if (!base.ok) return base;
  return { ok: true };
}

/**
 * Next calibration due: calibratedAt + k × interval, first strictly-future date.
 * O(1) arithmetic even after many missed intervals (v1 semantics).
 */
export function nextCalibrationDue(
  calibratedAt: Date,
  intervalDays: number | null | undefined,
  now: Date,
): Date | null {
  if (!intervalDays || intervalDays <= 0) return null;
  const base = calibratedAt.getTime();
  if (Number.isNaN(base)) return null;

  const step = intervalDays * DAY_MS;
  if (base + step > now.getTime()) return new Date(base + step);
  const cycles = Math.floor((now.getTime() - base) / step) + 1;
  return new Date(base + cycles * step);
}

/** Re-certification write: calibratedAt = now, expiresAt = calibratedAt + interval. */
export function recalibrate(
  inst: InstrumentInput,
  intervalDays: number,
  now: Date,
): Result<{ calibratedAt: Date; expiresAt: Date; location: InstrumentLocation }, "INVALID_INTERVAL" | "RETIRED"> {
  if (inst.lifecycle === "RETIRED") return err("RETIRED");
  if (!intervalDays || intervalDays <= 0) return err("INVALID_INTERVAL");
  return ok({
    calibratedAt: now,
    expiresAt: new Date(now.getTime() + intervalDays * DAY_MS),
    location: "LAB_CABINET",
  });
}
