import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyAttendance,
  computeAttendance,
} from "../src/lib/people/attendance";
import { isOk } from "../src/lib/core/result";

test("classifyAttendance marks single clock-in/out as PRESENT", () => {
  const logs = [
    { userId: "u1", clockIn: new Date("2026-09-05T08:00:00Z"), clockOut: new Date("2026-09-05T16:00:00Z"), status: "PRESENT" as const },
  ];
  const r = classifyAttendance(logs);
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.get("2026-09-05"), "PRESENT");
});

test("classifyAttendance marks late clock-in as LATE", () => {
  const logs = [
    { userId: "u1", clockIn: new Date("2026-09-05T10:00:00Z"), clockOut: new Date("2026-09-05T18:00:00Z"), status: "LATE" as const },
  ];
  const r = classifyAttendance(logs);
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.get("2026-09-05"), "LATE");
});

test("classifyAttendance marks missing clockOut as ABSENT", () => {
  const logs = [
    { userId: "u1", clockIn: new Date("2026-09-05T08:00:00Z"), clockOut: null, status: "PRESENT" as const },
  ];
  const r = classifyAttendance(logs);
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.get("2026-09-05"), "ABSENT");
});

test("computeAttendance aggregates monthly stats", () => {
  const logs = [
    { userId: "u1", clockIn: new Date("2026-09-01T08:00:00Z"), clockOut: new Date("2026-09-01T16:00:00Z"), status: "PRESENT" as const },
    { userId: "u1", clockIn: new Date("2026-09-02T08:00:00Z"), clockOut: new Date("2026-09-02T16:00:00Z"), status: "PRESENT" as const },
    { userId: "u1", clockIn: new Date("2026-09-03T10:00:00Z"), clockOut: new Date("2026-09-03T18:00:00Z"), status: "LATE" as const },
    { userId: "u1", clockIn: new Date("2026-09-04T08:00:00Z"), clockOut: null, status: "PRESENT" as const },
  ];
  const r = computeAttendance(logs, "u1", 2026, 9);
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.presentDays, 2);
    assert.equal(r.value.lateDays, 1);
    assert.equal(r.value.absentDays, 1);
    assert.equal(r.value.workedHours, 24);
  }
});
