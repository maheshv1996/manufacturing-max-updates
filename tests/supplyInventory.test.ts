import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMovement, varianceCheck, approveAdjustment } from "../src/lib/supply/inventory";

test("IN movement increases balance", () => {
  const r = applyMovement({ balance: 10 }, { type: "IN", qty: 5 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.state.balance, 15);
  assert.equal(r.write.type, "IN");
});

test("OUT movement decreases balance", () => {
  const r = applyMovement({ balance: 15 }, { type: "OUT", qty: 6 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.state.balance, 9);
});

test("OUT beyond balance is blocked (NEGATIVE_STOCK)", () => {
  const r = applyMovement({ balance: 10 }, { type: "OUT", qty: 11 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NEGATIVE_STOCK");
});

test("ADJUST without reason is blocked (ADJUST_REASON_REQUIRED)", () => {
  const r = applyMovement({ balance: 10 }, { type: "ADJUST", qty: -2 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ADJUST_REASON_REQUIRED");
});

test("ADJUST with reason applies the delta", () => {
  const r = applyMovement({ balance: 10 }, { type: "ADJUST", qty: -2, reason: "cycle count" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.state.balance, 8);
});

test("varianceCheck: within tolerance", () => {
  const v = varianceCheck(100, 103, 5);
  assert.equal(v.within, true);
  assert.equal(v.variance, 3);
});

test("varianceCheck: out of tolerance", () => {
  const v = varianceCheck(100, 94, 5);
  assert.equal(v.within, false);
  assert.equal(v.variance, -6);
});

test("approveAdjustment: in-tolerance variance passes without authority/reason", () => {
  const r = approveAdjustment(varianceCheck(100, 103, 5), {});
  assert.equal(r.ok, true);
});

test("approveAdjustment: out-of-tolerance without reason (REASON_REQUIRED)", () => {
  const r = approveAdjustment(varianceCheck(100, 90, 5), { authority: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "REASON_REQUIRED");
});

test("approveAdjustment: out-of-tolerance without authority (AUTHORITY_REQUIRED)", () => {
  const r = approveAdjustment(varianceCheck(100, 90, 5), { reason: "stocktake correction" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "AUTHORITY_REQUIRED");
});

test("approveAdjustment: out-of-tolerance with both passes", () => {
  const r = approveAdjustment(varianceCheck(100, 90, 5), { authority: true, reason: "stocktake correction" });
  assert.equal(r.ok, true);
});