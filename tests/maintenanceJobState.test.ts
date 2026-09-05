import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionJob, evaluateJobGuards, type JobStateInput } from "../src/lib/maintenance/jobState";
import { isOk, isErr } from "../src/lib/core/result";

const base: JobStateInput = {
  id: "j1",
  machineId: "m1",
  type: "PM",
  priority: "MEDIUM",
  description: "Lubrication round",
  status: "OPEN",
  openedAt: new Date("2026-09-01T06:00:00Z"),
};

test("OPEN → IN_PROGRESS (start)", () => {
  const r = transitionJob(base, { action: "START" });
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.status, "IN_PROGRESS");
});

test("CLOSE from OPEN is illegal — must acknowledge the work", () => {
  const r = transitionJob(base, { action: "CLOSE", laborHours: 2 });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "ILLEGAL_TRANSITION");
});

test("CLOSE requires laborHours (findings)", () => {
  const inProgress = { ...base, status: "IN_PROGRESS" as const };
  const r = transitionJob(inProgress, { action: "CLOSE" });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "FINDINGS_REQUIRED");
});

test("PM job closes with laborHours alone", () => {
  const inProgress = { ...base, status: "IN_PROGRESS" as const };
  const r = transitionJob(inProgress, { action: "CLOSE", laborHours: 1.5 });
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.status, "CLOSED");
    assert.ok(r.value.closedAt);
  }
});

test("BREAKDOWN close requires rootCause", () => {
  const breakdown = { ...base, type: "BREAKDOWN" as const, status: "IN_PROGRESS" as const };
  const r = transitionJob(breakdown, { action: "CLOSE", laborHours: 2 });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "ROOT_CAUSE_REQUIRED");
});

test("BREAKDOWN > 60 min requires countermeasure (P28)", () => {
  const breakdown = { ...base, type: "BREAKDOWN" as const, status: "IN_PROGRESS" as const };
  const r = transitionJob(breakdown, {
    action: "CLOSE",
    laborHours: 2.5, // > 1h
    rootCause: "Bearing seizure",
  });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "COUNTERMEASURE_REQUIRED");
});

test("BREAKDOWN > 60 min closes with RCA + countermeasure", () => {
  const breakdown = { ...base, type: "BREAKDOWN" as const, status: "IN_PROGRESS" as const };
  const r = transitionJob(breakdown, {
    action: "CLOSE",
    laborHours: 2.5,
    rootCause: "Bearing seizure",
    countermeasure: "PM frequency doubled + vibration monitoring",
  });
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.status, "CLOSED");
    assert.ok(r.value.closedAt);
  }
});

test("CLOSED is terminal", () => {
  const closed = { ...base, status: "CLOSED" as const, closedAt: new Date() };
  const r1 = transitionJob(closed, { action: "START" });
  assert.equal(isErr(r1), true);
  const r2 = transitionJob(closed, { action: "CLOSE", laborHours: 1 });
  assert.equal(isErr(r2), true);
});

test("evaluateJobGuards: duration from OPEN to now drives the P28 threshold", () => {
  const opened = new Date("2026-09-05T06:00:00Z");
  const now61 = new Date("2026-09-05T07:01:00Z"); // 61 min later
  const now30 = new Date("2026-09-05T06:30:00Z"); // 30 min later
  assert.equal(evaluateJobGuards({ ...base, type: "BREAKDOWN" }, opened, now61).countermeasureRequired, true);
  assert.equal(evaluateJobGuards({ ...base, type: "BREAKDOWN" }, opened, now30).countermeasureRequired, false);
  assert.equal(evaluateJobGuards(base, opened, now61).countermeasureRequired, false); // PM never requires it
});
