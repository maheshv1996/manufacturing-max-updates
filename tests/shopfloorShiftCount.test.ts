import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateShiftCount, resolveDispute } from "../src/lib/shopfloor/shiftCount";

test("in-count within tolerance is AGREED", () => {
  assert.equal(evaluateShiftCount(100, 102, 2), "AGREED");
});

test("in-count over tolerance is DISPUTED", () => {
  assert.equal(evaluateShiftCount(100, 110, 2), "DISPUTED");
});

test("exact match is AGREED; tolerance 0 still allows equal counts", () => {
  assert.equal(evaluateShiftCount(50, 50, 0), "AGREED");
  assert.equal(evaluateShiftCount(50, 51, 0), "DISPUTED");
});

test("missing outbound count with inbound pieces is DISPUTED", () => {
  assert.equal(evaluateShiftCount(0, 5, 5), "DISPUTED");
});

test("resolveDispute only from DISPUTED and with authority", () => {
  const ok = resolveDispute("DISPUTED", true);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.status, "RESOLVED");
});

test("resolveDispute without authority is blocked (AUTHORITY_REQUIRED)", () => {
  const r = resolveDispute("DISPUTED", false);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "AUTHORITY_REQUIRED");
});

test("resolveDispute from PENDING or RESOLVED is illegal", () => {
  for (const status of ["PENDING", "AGREED", "RESOLVED"] as const) {
    const r = resolveDispute(status, true);
    assert.equal(r.ok, false, `from ${status}`);
    if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION");
  }
});
