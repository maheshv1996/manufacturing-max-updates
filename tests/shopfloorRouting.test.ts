import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCheck } from "../src/lib/shopfloor/routing";

const steps = [
  { seq: 10, isHoldPoint: false },
  { seq: 20, isHoldPoint: true },
  { seq: 30, isHoldPoint: false },
];

test("advance from a non-hold-point step is allowed without signoffs", () => {
  const r = advanceCheck(10, steps, []);
  assert.equal(r.allowed, true);
});

test("advance from a hold-point step without a signoff is blocked (HOLD_POINT_UNSIGNED)", () => {
  const r = advanceCheck(20, steps, []);
  assert.equal(r.allowed, false);
  if (!r.allowed) {
    assert.equal(r.code, "HOLD_POINT_UNSIGNED");
    assert.equal(r.stepSeq, 20);
  }
});

test("advance from a hold-point step passes once a signoff exists for it", () => {
  const r = advanceCheck(20, steps, [{ routingStepSeq: 20, passed: true }]);
  assert.equal(r.allowed, true);
});

test("a concession signoff satisfies the hold-point gate", () => {
  const r = advanceCheck(20, steps, [{ routingStepSeq: 20, passed: true, concession: true }]);
  assert.equal(r.allowed, true);
});

test("a signoff for a different step does not release this hold point", () => {
  const r = advanceCheck(20, steps, [{ routingStepSeq: 10, passed: true }]);
  assert.equal(r.allowed, false);
});

test("advance past the last routing step is blocked (SEQ_BEYOND_ROUTING)", () => {
  const r = advanceCheck(40, steps, []);
  assert.equal(r.allowed, false);
  if (!r.allowed) assert.equal(r.code, "SEQ_BEYOND_ROUTING");
});
