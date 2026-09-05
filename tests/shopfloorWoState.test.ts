import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionWoStatus } from "../src/lib/shopfloor/woState";

test("START_JOB from PLANNED with readiness + fixture gates ok moves to IN_PROGRESS", () => {
  const r = transitionWoStatus("PLANNED", { action: "START_JOB", ready: true, fixtureOk: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "IN_PROGRESS");
});

test("START_JOB blocked when not ready (NOT_READY)", () => {
  const r = transitionWoStatus("PLANNED", { action: "START_JOB", ready: false, fixtureOk: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NOT_READY");
});

test("START_JOB blocked when fixture gate fails (FIXTURE_BLOCKED) even if ready", () => {
  const r = transitionWoStatus("PLANNED", { action: "START_JOB", ready: true, fixtureOk: false });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "FIXTURE_BLOCKED");
});

test("COMPLETE from IN_PROGRESS when good >= planned", () => {
  const r = transitionWoStatus("IN_PROGRESS", {
    action: "COMPLETE",
    goodQuantity: 10,
    plannedQuantity: 10,
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "COMPLETED");
});

test("COMPLETE blocked QTY_SHORT without override", () => {
  const r = transitionWoStatus("IN_PROGRESS", {
    action: "COMPLETE",
    goodQuantity: 7,
    plannedQuantity: 10,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "QTY_SHORT");
});

test("COMPLETE passes with authorized override when qty short", () => {
  const r = transitionWoStatus("IN_PROGRESS", {
    action: "COMPLETE",
    goodQuantity: 7,
    plannedQuantity: 10,
    override: true,
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "COMPLETED");
});

test("HOLD requires a reason; HOLD with reason then RESUME roundtrips", () => {
  const noReason = transitionWoStatus("IN_PROGRESS", { action: "HOLD" });
  assert.equal(noReason.ok, false);
  if (!noReason.ok) assert.equal(noReason.code, "REASON_REQUIRED");

  const held = transitionWoStatus("IN_PROGRESS", { action: "HOLD", reason: "material shortage" });
  assert.equal(held.ok, true);
  if (held.ok) assert.equal(held.status, "ON_HOLD");

  const resumed = transitionWoStatus("ON_HOLD", { action: "RESUME" });
  assert.equal(resumed.ok, true);
  if (resumed.ok) assert.equal(resumed.status, "IN_PROGRESS");
});

test("illegal transitions are rejected with ILLEGAL_TRANSITION", () => {
  const cases: Array<Parameters<typeof transitionWoStatus>> = [
    ["COMPLETED", { action: "START_JOB", ready: true, fixtureOk: true }],
    ["PLANNED", { action: "COMPLETE", goodQuantity: 5, plannedQuantity: 5 }],
    ["ON_HOLD", { action: "COMPLETE", goodQuantity: 5, plannedQuantity: 5 }],
    ["IN_PROGRESS", { action: "START_JOB", ready: true, fixtureOk: true }],
    ["COMPLETED", { action: "RESUME" }],
  ] as const;
  for (const [from, action] of cases) {
    const r = transitionWoStatus(from, action);
    assert.equal(r.ok, false, `expected block for ${from}`);
    if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION", `from ${from}`);
  }
});
