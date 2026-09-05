import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthDepreciation,
  generateSchedule,
  monthKey,
  monthsBetween,
  periodLabel,
  type FixedAssetInput,
} from "../src/lib/finance/fixedAssets";

const asset: FixedAssetInput = {
  cost: 100_00,
  salvageValue: 10_00,
  usefulLifeMonths: 12,
  method: "STRAIGHT_LINE",
  purchaseDate: new Date("2026-01-15"),
};

test("monthDepreciation: straight-line monthly charge", () => {
  const charge = monthDepreciation(asset, "2026-02", 0);
  assert.equal(charge, 7_50);
});

test("monthDepreciation: WDV method", () => {
  const wdvAsset: FixedAssetInput = {
    ...asset,
    method: "WDV",
  };
  const charge = monthDepreciation(wdvAsset, "2026-02", 0);
  assert.ok(charge > 0);
  assert.ok(charge <= 7_50);
});

test("monthDepreciation: before purchase date returns 0", () => {
  const charge = monthDepreciation(asset, "2025-12", 0);
  assert.equal(charge, 0);
});

test("generateSchedule: 12-month SL schedule sums to cost - salvage", () => {
  const schedule = generateSchedule(asset, "2027-01");
  assert.equal(schedule.length, 13);
  const totalDepreciation = schedule.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(totalDepreciation, 90_00);
  assert.equal(schedule[12].bookValueAfter, 10_00);
});

test("monthKey: formats date to YYYY-MM", () => {
  assert.equal(monthKey(new Date("2026-09-05")), "2026-09");
});

test("monthsBetween: calculates month difference", () => {
  assert.equal(monthsBetween("2026-01", "2026-06"), 5);
  assert.equal(monthsBetween("2026-06", "2026-01"), -5);
  assert.equal(monthsBetween("invalid", "2026-06"), 0);
});

test("periodLabel: formats YYYY-MM to readable string", () => {
  const label = periodLabel("2026-09");
  assert.ok(label.includes("2026"));
  assert.ok(label.toLowerCase().includes("sep"));
});
