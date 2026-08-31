// M14 — shared win/loss reason taxonomy for the enquiry funnel.
export const WIN_LOSS_REASONS = [
  "PRICE",
  "QUALITY",
  "DELIVERY",
  "COMPETITOR",
  "RELATIONSHIP",
  "OTHER",
] as const;

export type WinLossReason = (typeof WIN_LOSS_REASONS)[number];

// M16 — normalise a payment-terms string into days of credit (0 = ADVANCE/paid upfront).
export function termsDays(terms?: string | null): number {
  if (!terms) return 30;
  const t = String(terms).trim().toUpperCase();
  const m = t.match(/\bNET\s*(\d+)\b/);
  if (m) return parseInt(m[1], 10);
  if (t === "ADVANCE" || t === "PREPAID" || t === "CASH" || t === "COD")
    return 0;
  const bare = parseInt(t, 10);
  if (!isNaN(bare) && bare > 0) return bare;
  return 30; // default
}

// M15 — discount % off the suggested list price (0 when quoted at/above list).
export function computeDiscountPct(
  listTotal: number,
  quotedPrice: number,
): number {
  const safeList = Math.max(0, Number(listTotal) || 0);
  const safeQuoted = Math.max(0, Number(quotedPrice) || 0);
  if (!safeList || safeQuoted >= safeList) return 0;
  const pct = ((safeList - safeQuoted) / safeList) * 100;
  return Number(pct.toFixed(1));
}

// M15 — discount approval rules: any discount above 5% needs a manager sign-off.
export const DISCOUNT_APPROVAL_THRESHOLD = 5;

export function discountApprovalFor(
  pct: number,
  threshold: number = DISCOUNT_APPROVAL_THRESHOLD,
) {
  const safePct = Math.max(0, Number(pct) || 0);
  return safePct > threshold
    ? { discountApprovalStatus: "PENDING_MANAGER" }
    : { discountApprovalStatus: "APPROVED" };
}
