import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionNcr } from "../src/lib/quality/ncrState";

test("happy path: OPEN -> UNDER_REVIEW -> DISPOSITIONED(REWORK) -> CLOSED", () => {
  const r1 = transitionNcr("OPEN", { action: "START_REVIEW" });
  assert.equal(r1.ok, true);
  if (!r1.ok) return;
  assert.equal(r1.status, "UNDER_REVIEW");

  const r2 = transitionNcr("UNDER_REVIEW", {
    action: "DISPOSE",
    disposition: "REWORK",
    authority: "QUALITY",
    justification: "rework to print",
  });
  assert.equal(r2.ok, true);
  if (!r2.ok) return;
  assert.equal(r2.status, "DISPOSITIONED");

  const r3 = transitionNcr("DISPOSITIONED", { action: "CLOSE", closeNote: "rework completed" });
  assert.equal(r3.ok, true);
  if (r3.ok) assert.equal(r3.status, "CLOSED");
});

test("DISPOSE without justification is blocked (JUSTIFICATION_REQUIRED)", () => {
  const r = transitionNcr("UNDER_REVIEW", {
    action: "DISPOSE",
    disposition: "SCRAP",
    authority: "QUALITY",
    justification: "",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "JUSTIFICATION_REQUIRED");
});

test("USE_AS_IS without contract concession passes with QUALITY authority", () => {
  const r = transitionNcr("UNDER_REVIEW", {
    action: "DISPOSE",
    disposition: "USE_AS_IS",
    authority: "QUALITY",
    justification: "within spec tolerance per engineering",
    contractRequiresCustomerConcession: false,
  });
  assert.equal(r.ok, true);
});

test("USE_AS_IS with contract concession requires CUSTOMER authority", () => {
  const blocked = transitionNcr("UNDER_REVIEW", {
    action: "DISPOSE",
    disposition: "USE_AS_IS",
    authority: "QUALITY",
    justification: "minor cosmetic",
    contractRequiresCustomerConcession: true,
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "AUTHORITY_REQUIRED");

  const passes = transitionNcr("UNDER_REVIEW", {
    action: "DISPOSE",
    disposition: "USE_AS_IS",
    authority: "CUSTOMER",
    justification: "customer concession granted",
    contractRequiresCustomerConcession: true,
  });
  assert.equal(passes.ok, true);
});

test("CLOSE requires a written note (NOTE_REQUIRED)", () => {
  const r = transitionNcr("DISPOSITIONED", { action: "CLOSE" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NOTE_REQUIRED");
});

test("illegal transitions are rejected", () => {
  const cases: Array<Parameters<typeof transitionNcr>> = [
    ["OPEN", { action: "CLOSE", closeNote: "nope" }],
    ["OPEN", { action: "DISPOSE", disposition: "SCRAP", authority: "QUALITY", justification: "x" }],
    ["DISPOSITIONED", { action: "DISPOSE", disposition: "REWORK", authority: "QUALITY", justification: "x" }],
    ["CLOSED", { action: "START_REVIEW" }],
    ["CLOSED", { action: "CLOSE", closeNote: "again" }],
  ] as const;
  for (const [from, action] of cases) {
    const r = transitionNcr(from, action);
    assert.equal(r.ok, false, `expected block for ${from}`);
    if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION", `from ${from}`);
  }
});