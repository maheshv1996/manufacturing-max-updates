import { test } from "node:test";
import assert from "node:assert/strict";
import { isObsoleteRev, compareRevs, woAllowedRev, revisionGap } from "../src/lib/change/revision";

test("equal revisions are never obsolete", () => {
  assert.equal(isObsoleteRev("C", "C"), false);
});

test("a used revision different from current is obsolete", () => {
  assert.equal(isObsoleteRev("C", "B"), true);
  assert.equal(isObsoleteRev("B", "C"), true); // floor using a NEWER rev is also not law
});

test("numeric revisions compare numerically (rev 2 > rev 1)", () => {
  assert.equal(compareRevs("2", "1"), 1);
  assert.equal(compareRevs("1", "2"), -1);
  assert.equal(compareRevs("10", "9"), 1);
});

test("letter revisions compare as strings (A < B)", () => {
  assert.equal(compareRevs("A", "B"), -1);
  assert.equal(compareRevs("C", "C"), 0);
});

test("WO before a DATE effectivity may use the old revision (not obsolete)", () => {
  const r = woAllowedRev({
    woStart: new Date("2026-09-01"),
    effectivityType: "DATE",
    effectivityDate: new Date("2026-10-01"),
  });
  assert.equal(r.allowed, true);
  assert.equal(r.requiredRev, "current");
});

test("WO at/after a DATE effectivity must use the new revision", () => {
  const at = woAllowedRev({ woStart: new Date("2026-10-01"), effectivityType: "DATE", effectivityDate: new Date("2026-10-01") });
  assert.equal(at.allowed, false);
  const after = woAllowedRev({ woStart: new Date("2026-11-01"), effectivityType: "DATE", effectivityDate: new Date("2026-10-01") });
  assert.equal(after.allowed, false);
  if (!after.allowed) assert.equal(after.requiredRev, "current");
});

test("SERIAL effectivity defaults to new-revision-required (genealogy enforces serial split)", () => {
  const r = woAllowedRev({ woStart: new Date("2026-09-01"), effectivityType: "SERIAL" });
  assert.equal(r.allowed, false);
});

test("revisionGap shapes a C2-3 DRAWING_REV-ready result", () => {
  const gap = revisionGap({ currentRev: "C", usedRev: "B" });
  assert.equal(gap.ready, false);
  assert.equal(gap.gapCode, "DRAWING_REV");
  const ok = revisionGap({ currentRev: "C", usedRev: "C" });
  assert.equal(ok.ready, true);
});