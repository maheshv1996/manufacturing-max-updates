/**
 * M19 — Fixed-asset depreciation engine.
 * Straight-line: (cost − salvage) / usefulLifeMonths each month.
 * WDV: annual rate = 1 − (salvage/cost)^(1/lifeYears), applied monthly
 *       on the opening book value, never below salvage.
 */

export interface ScheduleRow {
  period: string; // YYYY-MM
  amount: number;
  bookValueAfter: number;
}

/** "YYYY-MM" of a date (local). */
export function monthKey(d: Date): string {
  const safeDate = d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, "0")}`;
}

export function monthsBetween(a: string, b: string): number {
  const [ay, am] = String(a || "").split("-").map(Number);
  const [by, bm] = String(b || "").split("-").map(Number);
  if (!Number.isFinite(ay) || !Number.isFinite(am) || !Number.isFinite(by) || !Number.isFinite(bm)) {
    return 0;
  }
  return (by - ay) * 12 + (bm - am);
}

function wdvMonthlyRate(
  cost: number,
  salvage: number,
  usefulLifeMonths: number,
): number {
  if (usefulLifeMonths <= 0 || cost <= 0) return 0;
  const lifeYears = usefulLifeMonths / 12;
  const safeSalvage = Math.min(cost, Math.max(0, salvage));
  const annualRate = 1 - Math.pow(safeSalvage / cost, 1 / lifeYears);
  return Math.max(0, annualRate) / 12;
}

/**
 * Depreciation charge for one asset in one period, given the accumulated
 * depreciation already booked up to the previous period.
 */
export function monthDepreciation(
  asset: {
    cost: number;
    salvageValue: number;
    usefulLifeMonths: number;
    method: "STRAIGHT_LINE" | "WDV";
    purchaseDate: Date;
  },
  period: string,
  accumulated: number,
): number {
  const startMonth = monthKey(asset.purchaseDate);
  const age = monthsBetween(startMonth, period);
  if (age < 0) return 0; // before purchase
  const openBook = asset.cost - accumulated;
  const floor = Math.max(0, asset.salvageValue);
  if (openBook <= floor) return 0;
  let charge: number;
  if (asset.method === "WDV") {
    charge =
      openBook * wdvMonthlyRate(asset.cost, floor, asset.usefulLifeMonths);
  } else {
    charge = (asset.cost - floor) / Math.max(1, asset.usefulLifeMonths);
  }
  charge = Math.min(charge, openBook - floor);
  return Number(charge.toFixed(2));
}

/**
 * Full projected schedule from the purchase month up to (and including) a
 * target period, running the same month-by-month accumulator the bookings use.
 */
export function generateSchedule(
  asset: {
    cost: number;
    salvageValue: number;
    usefulLifeMonths: number;
    method: "STRAIGHT_LINE" | "WDV";
    purchaseDate: Date;
  },
  upToPeriod: string,
): ScheduleRow[] {
  const startMonth = monthKey(asset.purchaseDate);
  const totalMonths = monthsBetween(startMonth, upToPeriod);
  if (totalMonths < 0) return [];

  let acc = 0;
  const rows: ScheduleRow[] = [];
  let cursor = startMonth;
  let iterations = 0;
  const maxIterations = Math.min(600, totalMonths + 1); // Safety limit of 50 years

  while (iterations < maxIterations) {
    iterations++;
    const amount = monthDepreciation(asset, cursor, acc);
    acc += amount;
    rows.push({
      period: cursor,
      amount,
      bookValueAfter: Number((asset.cost - acc).toFixed(2)),
    });
    if (cursor === upToPeriod) break;
    const [y, m] = cursor.split("-").map(Number);
    cursor =
      m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return rows;
}

/** Label for display, e.g. "2026-08" → "Aug 2026". */
export function periodLabel(period: string): string {
  const [y, m] = String(period || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return period || "—";
  }
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
