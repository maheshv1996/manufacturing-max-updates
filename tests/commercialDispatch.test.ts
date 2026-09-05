import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionDispatch, type DispatchStatus, type DispatchAction } from "../src/lib/commercial/dispatch";

const transitions: Array<{ from: DispatchStatus; to: DispatchStatus; action: DispatchAction }> = [
  { from: "PLANNED", to: "DISPATCHED", action: { action: "DISPATCH", vehicleNo: "MH01AB1234", driverName: "Rahul" } },
];

for (const t of transitions) {
  test(`${t.from} -> ${t.action.action} -> ${t.to}`, () => {
    const r = transitionDispatch(t.from, t.action);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.status, t.to);
  });
}

const illegalCases: Array<{ from: DispatchStatus; action: DispatchAction; expectCode: string }> = [
  { from: "DISPATCHED", action: { action: "CANCEL", reason: "error" }, expectCode: "TERMINAL_STATE" },
  { from: "DISPATCHED", action: { action: "DISPATCH", vehicleNo: "MH01AB1234", driverName: "Rahul" }, expectCode: "ILLEGAL_TRANSITION" },
];

for (const c of illegalCases) {
  test(`${c.from} + ${c.action.action} blocked (${c.expectCode})`, () => {
    const r = transitionDispatch(c.from, c.action);
    assert.equal(r.ok, false, `expected block for ${c.from} -> ${c.action.action}`);
    if (!r.ok) assert.equal(r.code, c.expectCode);
  });
}

test("DISPATCH requires vehicleNo (REASON_REQUIRED)", () => {
  const r = transitionDispatch("PLANNED", { action: "DISPATCH", vehicleNo: "", driverName: "Rahul" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "REASON_REQUIRED");
});

test("DISPATCH requires driverName (REASON_REQUIRED)", () => {
  const r = transitionDispatch("PLANNED", { action: "DISPATCH", vehicleNo: "MH01AB1234", driverName: "" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "REASON_REQUIRED");
});
