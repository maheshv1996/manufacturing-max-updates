import { test } from "node:test";
import assert from "node:assert/strict";
import { periodForDate, DEFAULT_COA } from "../src/lib/finance/glCore";

test("periodForDate: valid date", () => {
  assert.equal(periodForDate(new Date("2026-09-05")), "2026-09");
});

test("periodForDate: invalid date falls back to now", () => {
  const now = new Date();
  const r = periodForDate(new Date("invalid"));
  assert.equal(r, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
});

test("DEFAULT_COA has expected accounts", () => {
  const codes = DEFAULT_COA.map((a) => a.code);
  assert.ok(codes.includes("1010"));
  assert.ok(codes.includes("4010"));
  assert.ok(codes.includes("5010"));
  assert.ok(codes.includes("1260"));
  assert.equal(DEFAULT_COA.length, 50);
});

test("DEFAULT_COA: Accumulated Depreciation is CREDIT normal balance", () => {
  const acc = DEFAULT_COA.find((a) => a.code === "1260");
  assert.ok(acc);
  assert.equal(acc?.normalBalance, "CREDIT");
});
