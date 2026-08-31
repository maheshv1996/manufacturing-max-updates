export type CalibrationStatus = "OK" | "EXPIRING_SOON" | "EXPIRED";
export type VendorStatus = "APPROVED" | "EXPIRING_SOON" | "EXPIRED";

export const CALIBRATION_WARNING_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days remaining until expiry (negative = already past).
 * Safe against invalid date strings or NaN timestamp inputs.
 */
export function daysUntil(expiresAt?: Date | string | null): number {
  if (!expiresAt) return 0;
  const time = new Date(expiresAt).getTime();
  if (isNaN(time)) return 0;

  const diffMs = time - Date.now();
  // Round to nearest integer day to avoid edge case truncation for same-day expiries
  return Math.round(diffMs / DAY_MS);
}

/**
 * Live calibration status derived from expiry date.
 * EXPIRED when past expiry; EXPIRING_SOON within the warning threshold (default 30 days); else OK.
 */
export function computeCalibrationStatus(
  expiresAt?: Date | string | null,
  warningDays = CALIBRATION_WARNING_DAYS,
): CalibrationStatus {
  if (!expiresAt) return "EXPIRED";
  const days = daysUntil(expiresAt);
  if (days <= 0) return "EXPIRED";
  if (days <= warningDays) return "EXPIRING_SOON";
  return "OK";
}

/**
 * Live special-process vendor approval status derived from Nadcap certificate expiry.
 */
export function computeVendorStatus(
  expiresAt?: Date | string | null,
  warningDays = CALIBRATION_WARNING_DAYS,
): VendorStatus {
  if (!expiresAt) return "EXPIRED";
  const days = daysUntil(expiresAt);
  if (days <= 0) return "EXPIRED";
  if (days <= warningDays) return "EXPIRING_SOON";
  return "APPROVED";
}

export type InstrumentLocation =
  | "LAB_CABINET"
  | "WITH_OPERATOR"
  | "SHOPFLOOR"
  | "QUARANTINE"
  | "TOOL_CRIB";

const VALID_LOCATIONS: Set<string> = new Set([
  "LAB_CABINET",
  "WITH_OPERATOR",
  "SHOPFLOOR",
  "QUARANTINE",
  "TOOL_CRIB",
]);

export type InstrumentLifecycle = "PROCUREMENT" | "ACTIVE" | "RETIRED";

export interface ToolCribInfo {
  lifecycle?: string | null;
  expiresAt?: Date | string | null;
  location?: string | null;
}

/**
 * Effective instrument location.
 * RETIRED tools are gone from circulation; EXPIRED tools are auto-quarantined (the cage)
 * and cannot be issued until recalibrated per ISO/IEC 17025.
 */
export function effectiveLocation(
  tool: ToolCribInfo,
): InstrumentLocation | "RETIRED" {
  if (tool.lifecycle === "RETIRED") return "RETIRED";
  if (computeCalibrationStatus(tool.expiresAt) === "EXPIRED") return "QUARANTINE";

  const loc = String(tool.location || "").toUpperCase();
  if (VALID_LOCATIONS.has(loc)) {
    return loc as InstrumentLocation;
  }
  return "LAB_CABINET";
}

/**
 * Next calibration due date based on the calibration interval.
 * Uses O(1) arithmetic instead of iterative while loops.
 * Returns null when no interval is configured.
 */
export function nextCalibrationDue(
  calibratedAt?: Date | string | null,
  intervalDays?: number | null,
): Date | null {
  if (!calibratedAt || !intervalDays || intervalDays <= 0) return null;
  const base = new Date(calibratedAt).getTime();
  if (isNaN(base)) return null;

  const step = intervalDays * DAY_MS;
  const now = Date.now();

  if (base + step > now) {
    return new Date(base + step);
  }

  // O(1) interval advancement to the next future due date
  const elapsed = now - base;
  const cycles = Math.floor(elapsed / step) + 1;
  return new Date(base + cycles * step);
}
