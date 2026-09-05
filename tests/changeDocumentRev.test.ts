import { test } from "node:test";
import assert from "node:assert/strict";
import { issueRevision, canUseRev } from "../src/lib/change/documentRev";

test("issuing a forward revision is allowed", () => {
  const r = issueRevision("B", "C");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.nextRev, "C");
});

test("numeric revisions issue forward (1 -> 2)", () => {
  const r = issueRevision("1", "2");
  assert.equal(r.ok, true);
});

test("downgrades and same-rev issues are blocked (REV_NOT_FORWARD)", () => {
  for (const [cur, next] of [["C", "B"], ["C", "C"], ["2", "1"]]) {
    const r = issueRevision(cur, next);
    assert.equal(r.ok, false, `${cur} -> ${next}`);
    if (!r.ok) assert.equal(r.code, "REV_NOT_FORWARD");
  }
});

test("empty or whitespace revisions are rejected", () => {
  for (const [cur, next] of [["", "C"], ["C", ""], ["C", " C "]]) {
    const r = issueRevision(cur, next);
    assert.equal(r.ok, false, `${JSON.stringify(cur)} -> ${JSON.stringify(next)}`);
    if (!r.ok) assert.equal(r.code, "REV_NOT_FORWARD");
  }
});

test("canUseRev: the floor may only use the current revision", () => {
  assert.equal(canUseRev("C", "C").ok, true);
  const r = canUseRev("C", "B");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "OBSOLETE_REV");
});