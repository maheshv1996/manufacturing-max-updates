import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionEco } from "../src/lib/change/eco";

test("happy path: DRAFT -> APPROVED (DATE effectivity) -> IMPLEMENTED", () => {
  const ok = transitionEco("DRAFT", {
    action: "APPROVE",
    itemCount: 2,
    effectivityType: "DATE",
    effectivityValue: "2026-10-01",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.status, "APPROVED");

  const impl = transitionEco("APPROVED", { action: "IMPLEMENT", note: "implemented on the line" });
  assert.equal(impl.ok, true);
  if (impl.ok) assert.equal(impl.status, "IMPLEMENTED");
});

test("APPROVE with zero items is blocked (NO_ITEMS)", () => {
  const r = transitionEco("DRAFT", { action: "APPROVE", itemCount: 0, effectivityType: "DATE", effectivityValue: "2026-10-01" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NO_ITEMS");
});

test("DATE effectivity must be a parseable ISO date (EFFECTIVITY_INVALID)", () => {
  for (const bad of ["", "soon", "01/10/2026", "2026-13-99"]) {
    const r = transitionEco("DRAFT", { action: "APPROVE", itemCount: 1, effectivityType: "DATE", effectivityValue: bad });
    assert.equal(r.ok, false, `date '${bad}' should be rejected`);
    if (!r.ok) assert.equal(r.code, "EFFECTIVITY_INVALID", `date '${bad}'`);
  }
  const good = transitionEco("DRAFT", { action: "APPROVE", itemCount: 1, effectivityType: "DATE", effectivityValue: "2026-10-01" });
  assert.equal(good.ok, true);
});

test("SERIAL effectivity accepts N, N+, and A..B ranges", () => {
  for (const v of ["10", "10+", "1..50"]) {
    const r = transitionEco("DRAFT", { action: "APPROVE", itemCount: 1, effectivityType: "SERIAL", effectivityValue: v });
    assert.equal(r.ok, true, `serial '${v}' should pass`);
  }
});

test("SERIAL effectivity rejects junk (EFFECTIVITY_INVALID)", () => {
  for (const v of ["", "all", "10-50", "1..", "..5"]) {
    const r = transitionEco("DRAFT", { action: "APPROVE", itemCount: 1, effectivityType: "SERIAL", effectivityValue: v });
    assert.equal(r.ok, false, `serial '${v}' should be rejected`);
    if (!r.ok) assert.equal(r.code, "EFFECTIVITY_INVALID");
  }
});

test("REJECT requires a written note (NOTE_REQUIRED)", () => {
  const r = transitionEco("DRAFT", { action: "REJECT" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NOTE_REQUIRED");
  const ok = transitionEco("DRAFT", { action: "REJECT", note: "customer vetoed" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.status, "REJECTED");
});

test("G-5: IMPLEMENTED is reachable only from APPROVED", () => {
  for (const from of ["DRAFT", "REJECTED"] as const) {
    const r = transitionEco(from, { action: "IMPLEMENT" });
    assert.equal(r.ok, false, `from ${from}`);
    if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION");
  }
});

test("REJECT from APPROVED and IMPLEMENTED is illegal; REJECTED/IMPLEMENTED are terminal", () => {
  const rejectApproved = transitionEco("APPROVED", { action: "REJECT", note: "late" });
  assert.equal(rejectApproved.ok, false);
  if (!rejectApproved.ok) assert.equal(rejectApproved.code, "ILLEGAL_TRANSITION");

  const rejectImpl = transitionEco("IMPLEMENTED", { action: "REJECT", note: "nope" });
  assert.equal(rejectImpl.ok, false);
  if (!rejectImpl.ok) assert.equal(rejectImpl.code, "ILLEGAL_TRANSITION");

  const reapprove = transitionEco("REJECTED", { action: "APPROVE", itemCount: 1, effectivityType: "DATE", effectivityValue: "2026-10-01" });
  assert.equal(reapprove.ok, false);
  if (!reapprove.ok) assert.equal(reapprove.code, "ILLEGAL_TRANSITION");
});