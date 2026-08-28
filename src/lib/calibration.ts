export type CalibrationStatus = "OK" | "EXPIRING_SOON" | "EXPIRED";
export type VendorStatus = "APPROVED" | "EXPIRED";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days remaining until expiry (negative = already past). */
export function daysUntil(expiresAt: Date | string): number {
  return Math.floor((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
}

/**
 * Live calibration status derived from expiry date.
 * EXPIRED when past expiry; EXPIRING_SOON within the next 30 days; else OK.
 */
export function computeCalibrationStatus(
  expiresAt: Date | string,
): CalibrationStatus {
  const days = daysUntil(expiresAt);
  if (days <= 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "OK";
}

/** Live special-process vendor approval status derived from Nadcap certificate expiry. */
export function computeVendorStatus(expiresAt: Date | string): VendorStatus {
  return daysUntil(expiresAt) <= 0 ? "EXPIRED" : "APPROVED";
}

export type InstrumentLocation =
  "LAB_CABINET" | "WITH_OPERATOR" | "SHOPFLOOR" | "QUARANTINE";

export type InstrumentLifecycle = "PROCUREMENT" | "ACTIVE" | "RETIRED";

export interface ToolCribInfo {
  lifecycle?: string | null;
  expiresAt: Date | string;
  location?: string | null;
}

/**
 * Effective instrument location.
 * RETIRED tools are gone from circulation; EXPIRED tools are auto-quarantined
 * (the cage) and cannot be issued until recalibrated.
 */
export function effectiveLocation(
  tool: ToolCribInfo,
): InstrumentLocation | "RETIRED" {
  if (tool.lifecycle === "RETIRED") return "RETIRED";
  if (computeCalibrationStatus(tool.expiresAt) === "EXPIRED")
    return "QUARANTINE";
  return (tool.location as InstrumentLocation) || "LAB_CABINET";
}

/**
 * Next calibration due date based on the calibration interval, rolled forward
 * from the last calibration date until it falls in the future.
 * Returns null when no interval is configured.
 */
export function nextCalibrationDue(
  calibratedAt: Date | string,
  intervalDays: number | null | undefined,
): Date | null {
  if (!intervalDays || intervalDays <= 0) return null;
  const base = new Date(calibratedAt).getTime();
  const step = intervalDays * DAY_MS;
  let last = base;
  while (last + step <= Date.now()) {
    last += step;
  }
  return new Date(last + step);
}
