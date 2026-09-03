import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeRisk,
  nextReviewDate,
  reviewStatus,
  isValidCategory,
  REVIEW_INTERVAL_DAYS,
  RISK_CATEGORIES,
} from "../src/lib/riskRegister";

test("computeRisk maps L×I to the right level bands", () => {
  assert.deepEqual(computeRisk(1, 1), { score: 1, level: "LOW" });
  assert.deepEqual(computeRisk(2, 2), { score: 4, level: "MEDIUM" });
  assert.deepEqual(computeRisk(3, 2), { score: 6, level: "MEDIUM" });
  assert.deepEqual(computeRisk(4, 2), { score: 8, level: "HIGH" });
  assert.deepEqual(computeRisk(3, 4), { score: 12, level: "HIGH" });
  assert.deepEqual(computeRisk(4, 4), { score: 16, level: "CRITICAL" });
  assert.deepEqual(computeRisk(5, 5), { score: 25, level: "CRITICAL" });
});

test("computeRisk clamps out-of-range inputs", () => {
  // 0 → 1, 9 → 5: L1 × I5 = 5 (MEDIUM)
  assert.deepEqual(computeRisk(0, 9), { score: 5, level: "MEDIUM" });
  assert.deepEqual(computeRisk(-3, 0), { score: 1, level: "LOW" });
  assert.deepEqual(computeRisk("x" as any, "y" as any), { score: 1, level: "LOW" });
});

test("review cadence is quarterly with DUE/OVERDUE windows", () => {
  const now = new Date("2026-09-04T00:00:00Z");
  const next = nextReviewDate(now);
  const days =
    Math.round((next.getTime() - now.getTime()) / 86400000);
  assert.equal(days, REVIEW_INTERVAL_DAYS);

  // Valid: 60 days out
  assert.deepEqual(reviewStatus(new Date(now.getTime() + 60 * 86400000), now), {
    reviewStatus: "VALID",
    daysLeft: 60,
  });
  // Due: within 14 days
  assert.deepEqual(reviewStatus(new Date(now.getTime() + 10 * 86400000), now), {
    reviewStatus: "DUE",
    daysLeft: 10,
  });
  // Overdue: any time before now
  assert.equal(
    reviewStatus(new Date(now.getTime() - 86400000), now).reviewStatus,
    "OVERDUE",
  );
  // Missing date → treated as fresh
  assert.equal(reviewStatus(null, now).reviewStatus, "VALID");
});

test("category vocabulary is fixed and validated", () => {
  assert.equal(isValidCategory("SUPPLY"), true);
  assert.equal(isValidCategory("QUALITY"), true);
  assert.equal(isValidCategory("bogus"), false);
  assert.ok(RISK_CATEGORIES.includes("COMPLIANCE"));
  assert.ok(RISK_CATEGORIES.includes("ENVIRONMENT"));
});