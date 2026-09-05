import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionFai } from "../src/lib/quality/fai";

const chars = (overrides: Array<Partial<{ id: string; pass: boolean; deviationJustified: boolean }>> = []) =>
  overrides.map((o, i) => ({ id: o.id ?? `c${i}`, pass: o.pass ?? true, deviationJustified: o.deviationJustified ?? false }));

test("SUBMIT with all-pass characteristics moves to SUBMITTED", () => {
  const r = transitionFai("IN_PROGRESS", { action: "SUBMIT", characteristics: chars([{}, {}]) });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "SUBMITTED");
});

test("SUBMIT with a justified deviation is allowed", () => {
  const r = transitionFai("IN_PROGRESS", {
    action: "SUBMIT",
    characteristics: chars([{ pass: true }, { id: "c5", pass: false, deviationJustified: true }]),
  });
  assert.equal(r.ok, true);
});

test("SUBMIT with an unjustified FAIL is blocked (UNJUSTIFIED_DEVIATION naming the characteristic)", () => {
  const r = transitionFai("IN_PROGRESS", {
    action: "SUBMIT",
    characteristics: chars([{ pass: true }, { id: "c5", pass: false }]),
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "UNJUSTIFIED_DEVIATION");
    assert.ok(r.characteristics?.includes("c5"));
  }
});

test("SUBMIT with no characteristics is blocked (NO_CHARACTERISTICS)", () => {
  const r = transitionFai("IN_PROGRESS", { action: "SUBMIT", characteristics: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NO_CHARACTERISTICS");
});

test("DECIDE approve from SUBMITTED -> APPROVED; reject -> REJECTED", () => {
  const ok = transitionFai("SUBMITTED", { action: "DECIDE", approve: true, characteristics: [] });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.status, "APPROVED");

  const no = transitionFai("SUBMITTED", { action: "DECIDE", approve: false, characteristics: [] });
  assert.equal(no.ok, true);
  if (no.ok) assert.equal(no.status, "REJECTED");
});

test("illegal transitions are rejected", () => {
  const cases: Array<Parameters<typeof transitionFai>> = [
    ["IN_PROGRESS", { action: "DECIDE", approve: true, characteristics: [] }],
    ["APPROVED", { action: "SUBMIT", characteristics: chars([{}]) }],
    ["REJECTED", { action: "DECIDE", approve: true, characteristics: [] }],
    ["SUBMITTED", { action: "SUBMIT", characteristics: chars([{}]) }],
  ] as const;
  for (const [from, action] of cases) {
    const r = transitionFai(from, action);
    assert.equal(r.ok, false, `expected block for ${from}`);
    if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION", `from ${from}`);
  }
});