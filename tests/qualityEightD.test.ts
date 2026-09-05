import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceEightD, type EightDStage } from "../src/lib/quality/eightD";

const ALL: EightDStage[] = [
  "D1_TEAM",
  "D2_PROBLEM",
  "D3_CONTAINMENT",
  "D4_ROOT_CAUSE",
  "D5_CORRECTIVE",
  "D6_PREVENTIVE",
  "D7_VERIFY",
  "D8_CLOSURE",
  "CLOSED",
];

const FULL_EVIDENCE = {
  containmentRecorded: true,
  d4RootCause: "broken tool insert",
  d5Corrective: "replace insert, update PM",
  d6Preventive: "add insert-life alarm",
  d7Verification: "100 pcs monitored, zero repeats",
};

test("full walk D1 -> CLOSED with complete evidence", () => {
  let stage: EightDStage = "D1_TEAM";
  for (const want of ALL.slice(1, 8)) {
    const r = advanceEightD(stage, FULL_EVIDENCE);
    assert.equal(r.ok, true, `advance ${stage} -> ${want}`);
    if (!r.ok) return;
    assert.equal(r.status, want);
    stage = r.status;
  }
  const close = advanceEightD("D8_CLOSURE", FULL_EVIDENCE, { reviewed: true });
  assert.equal(close.ok, true);
  if (close.ok) assert.equal(close.status, "CLOSED");
});

test("leaving D4 without root cause is blocked (EVIDENCE_MISSING)", () => {
  const r = advanceEightD("D4_ROOT_CAUSE", { ...FULL_EVIDENCE, d4RootCause: "" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "EVIDENCE_MISSING");
    assert.ok(r.missing?.includes("root cause"), `missing should name root cause: ${r.missing}`);
  }
});

test("leaving D7 without verification is blocked", () => {
  const r = advanceEightD("D7_VERIFY", { ...FULL_EVIDENCE, d7Verification: "" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "EVIDENCE_MISSING");
});

test("G-3: entering D8_CLOSURE requires all of D4-D7 evidence", () => {
  const r = advanceEightD("D7_VERIFY", { ...FULL_EVIDENCE, d5Corrective: "" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "EVIDENCE_MISSING");
    assert.ok(r.missing?.includes("corrective"));
  }
});

test("D8_CLOSURE -> CLOSED without quality-manager review is blocked (REVIEW_REQUIRED)", () => {
  const r = advanceEightD("D8_CLOSURE", FULL_EVIDENCE);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "REVIEW_REQUIRED");
});

test("stage skipping and moves from CLOSED are illegal", () => {
  const skip = advanceEightD("D2_PROBLEM", FULL_EVIDENCE, { to: "D4_ROOT_CAUSE" });
  assert.equal(skip.ok, false);
  if (!skip.ok) assert.equal(skip.code, "ILLEGAL_TRANSITION");

  const fromClosed = advanceEightD("CLOSED", FULL_EVIDENCE);
  assert.equal(fromClosed.ok, false);
  if (!fromClosed.ok) assert.equal(fromClosed.code, "ILLEGAL_TRANSITION");
});

test("D1 -> D2 never requires evidence (no evidence-bearing stage yet)", () => {
  const r = advanceEightD("D1_TEAM", {});
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "D2_PROBLEM");
});