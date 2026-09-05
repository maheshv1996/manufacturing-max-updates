import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePmDue, type PmRuleInput } from "../src/lib/maintenance/pm";

const DAY = 24 * 60 * 60 * 1000;

const never: PmRuleInput = {
  id: "pm1",
  machineId: "m1",
  title: "Monthly lubrication",
  intervalDays: 30,
  lastDoneAt: null,
};

test("never-done rule is due immediately", () => {
  const r = evaluatePmDue(never, { now: new Date("2026-09-05T00:00:00Z") });
  assert.equal(r.due, true);
  assert.equal(r.reason, "NEVER_DONE");
});

test("calendar rule inside the window is not due", () => {
  const rule: PmRuleInput = { ...never, lastDoneAt: new Date("2026-09-01T00:00:00Z") };
  const r = evaluatePmDue(rule, { now: new Date("2026-09-15T00:00:00Z") }); // day 14 of 30
  assert.equal(r.due, false);
});

test("calendar rule past the interval is due", () => {
  const rule: PmRuleInput = { ...never, lastDoneAt: new Date("2026-08-01T00:00:00Z") };
  const r = evaluatePmDue(rule, { now: new Date("2026-09-05T00:00:00Z") }); // day 35
  assert.equal(r.due, true);
  assert.equal(r.reason, "CALENDAR");
  assert.ok(r.overdueDays && r.overdueDays > 0);
});

test("run-hour rule due when usage since last PM exceeds the interval", () => {
  const rule: PmRuleInput = {
    ...never,
    intervalDays: null,
    intervalRunHours: 500,
    lastDoneAt: new Date("2026-09-01T00:00:00Z"),
  };
  const r = evaluatePmDue(rule, {
    now: new Date("2026-09-05T00:00:00Z"),
    runHoursSinceLast: 520,
  });
  assert.equal(r.due, true);
  assert.equal(r.reason, "RUN_HOURS");
});

test("run-hour rule not due under the interval", () => {
  const rule: PmRuleInput = {
    ...never,
    intervalDays: null,
    intervalRunHours: 500,
    lastDoneAt: new Date("2026-09-01T00:00:00Z"),
  };
  const r = evaluatePmDue(rule, {
    now: new Date("2026-09-05T00:00:00Z"),
    runHoursSinceLast: 480,
  });
  assert.equal(r.due, false);
});

test("run-hour rule with no usage data defaults to not due (no false alarms)", () => {
  const rule: PmRuleInput = {
    ...never,
    intervalDays: null,
    intervalRunHours: 500,
    lastDoneAt: new Date("2026-09-01T00:00:00Z"),
  };
  const r = evaluatePmDue(rule, { now: new Date("2026-09-05T00:00:00Z") });
  assert.equal(r.due, false);
});

test("inactive rule never fires", () => {
  const r = evaluatePmDue({ ...never, isActive: false }, { now: new Date("2026-09-05T00:00:00Z") });
  assert.equal(r.due, false);
});

test("either trigger type fires: calendar-due wins when both configured", () => {
  const rule: PmRuleInput = {
    ...never,
    intervalDays: 30,
    intervalRunHours: 100,
    lastDoneAt: new Date(Date.now() - 40 * DAY),
  };
  const r = evaluatePmDue(rule, { now: new Date(), runHoursSinceLast: 30 });
  assert.equal(r.due, true);
  assert.equal(r.reason, "CALENDAR");
});
