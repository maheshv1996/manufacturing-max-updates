/**
 * Enterprise risk register — ISO 9001:2015 cl.6.1 / ISO 45001 cl.6.1.2 style
 * risk-based thinking, kept simple enough for a mid-size plant:
 *
 *   score  = likelihood (1-5) × impact (1-5)
 *   level  = LOW (1-3) · MEDIUM (4-7) · HIGH (8-14) · CRITICAL (15-25)
 *
 * Every risk carries an accountable owner, mitigation + contingency plans,
 * and a quarterly review cadence. Overdue reviews and HIGH/CRITICAL open
 * risks surface in the compliance digest + notification bell — which already
 * feed the MRM (management review) agenda, so risks walk into the monthly
 * management meeting automatically.
 */
export const RISK_CATEGORIES = [
  "SAFETY",
  "QUALITY",
  "SUPPLY",
  "FINANCIAL",
  "COMPLIANCE",
  "OPERATIONAL",
  "MARKET",
  "IT",
  "HR",
  "ENVIRONMENT",
  "STRATEGIC",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  SAFETY: "Safety",
  QUALITY: "Quality",
  SUPPLY: "Supply Chain",
  FINANCIAL: "Financial",
  COMPLIANCE: "Statutory & Compliance",
  OPERATIONAL: "Operational",
  MARKET: "Market",
  IT: "IT & Data",
  HR: "People",
  ENVIRONMENT: "Environment",
  STRATEGIC: "Strategic",
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const LEVEL_TONE: Record<RiskLevel, "success" | "warning" | "danger" | "critical"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "critical",
};

export function computeRisk(
  likelihood: number,
  impact: number,
): { score: number; level: RiskLevel } {
  const l = Math.max(1, Math.min(5, Math.round(Number(likelihood) || 1)));
  const i = Math.max(1, Math.min(5, Math.round(Number(impact) || 1)));
  const score = l * i;
  const level: RiskLevel =
    score >= 15 ? "CRITICAL" : score >= 8 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW";
  return { score, level };
}

export const REVIEW_INTERVAL_DAYS = 90; // quarterly review cadence

export function nextReviewDate(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + REVIEW_INTERVAL_DAYS);
  return d;
}

export type ReviewStatus = "VALID" | "DUE" | "OVERDUE";

/** Review health of an open/mitigated risk: overdue once the review date passes. */
export function reviewStatus(
  reviewDueAt: Date | string | null | undefined,
  now: Date = new Date(),
): { reviewStatus: ReviewStatus; daysLeft: number } {
  if (!reviewDueAt) return { reviewStatus: "VALID", daysLeft: REVIEW_INTERVAL_DAYS };
  const due = new Date(reviewDueAt);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return { reviewStatus: "OVERDUE", daysLeft };
  if (daysLeft <= 14) return { reviewStatus: "DUE", daysLeft };
  return { reviewStatus: "VALID", daysLeft };
}

export function isValidCategory(c: string): boolean {
  return (RISK_CATEGORIES as readonly string[]).includes(c);
}