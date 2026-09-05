import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyLedgerEvent,
  emptyRunState,
  type LedgerEvent,
} from "../src/lib/shopfloor/eventLedger";

const T0 = "2026-09-05T08:00:00.000Z";
const T1 = "2026-09-05T08:30:00.000Z";

function fresh(): ReturnType<typeof emptyRunState> {
  return emptyRunState({ workOrderId: "wo1", machineId: "m1" });
}

function started(): ReturnType<typeof emptyRunState> {
  const r = fresh();
  const res = applyLedgerEvent(r, { kind: "START_JOB", at: T0 });
  if (res.ok) return res.state;
  throw new Error(res.message);
}

test("START_JOB opens a zeroed log and sets machine RUNNING", () => {
  const s = fresh();
  const r = applyLedgerEvent(s, { kind: "START_JOB", at: T0 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.notEqual(r.state.openLog, null);
  assert.equal(r.state.machineState, "RUNNING");
  assert.equal(r.state.goodTotal, 0);
});

test("GOOD/SCRAP/REWORK accumulate into the open log and totals", () => {
  let s = started();
  for (const ev of [
    { kind: "GOOD", qty: 3, at: T0 },
    { kind: "SCRAP", qty: 1, defectCode: "DIM", at: T0 },
    { kind: "REWORK", qty: 2, at: T0 },
  ] as LedgerEvent[]) {
    const r = applyLedgerEvent(s, ev);
    assert.equal(r.ok, true);
    if (r.ok) s = r.state;
  }
  assert.equal(s.openLog?.good, 3);
  assert.equal(s.openLog?.scrap, 1);
  assert.equal(s.openLog?.rework, 2);
  assert.equal(s.goodTotal, 3);
  assert.equal(s.scrapTotal, 1);
  assert.equal(s.reworkTotal, 2);
});

test("counter events before a log is open are rejected (NO_OPEN_LOG)", () => {
  const s = fresh();
  const r = applyLedgerEvent(s, { kind: "GOOD", qty: 1, at: T0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NO_OPEN_LOG");
});

test("non-positive or non-integer qty is rejected (INVALID_QTY)", () => {
  const s = started();
  for (const qty of [0, -2, 1.5]) {
    const r = applyLedgerEvent(s, { kind: "GOOD", qty, at: T0 });
    assert.equal(r.ok, false, `qty ${qty} should be rejected`);
    if (!r.ok) assert.equal(r.code, "INVALID_QTY");
  }
});

test("downtime open/close pair closes with a computed duration write", () => {
  let s = started();
  const open = applyLedgerEvent(s, { kind: "DOWNTIME_START", reasonCode: "BREAKDOWN", at: T0 });
  assert.equal(open.ok, true);
  if (!open.ok) return;
  s = open.state;
  assert.notEqual(s.openDowntime, null);

  const close = applyLedgerEvent(s, { kind: "DOWNTIME_END", at: T1 });
  assert.equal(close.ok, true);
  if (!close.ok) return;
  assert.equal(close.state.openDowntime, null);
  const writes = close.writes;
  const closeWrite = writes.find((w) => w.op === "DOWNTIME_CLOSE");
  assert.ok(closeWrite && closeWrite.op === "DOWNTIME_CLOSE");
  if (closeWrite?.op === "DOWNTIME_CLOSE") {
    assert.equal(closeWrite.durationMinutes, 30);
    assert.equal(closeWrite.reasonCode, "BREAKDOWN");
  }
});

test("double DOWNTIME_START is rejected (DOWNTIME_ALREADY_OPEN)", () => {
  const s = started();
  const first = applyLedgerEvent(s, { kind: "DOWNTIME_START", reasonCode: "BREAKDOWN", at: T0 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = applyLedgerEvent(first.state, { kind: "DOWNTIME_START", reasonCode: "POWER", at: T0 });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, "DOWNTIME_ALREADY_OPEN");
});

test("DOWNTIME_END without an open downtime is rejected (NO_OPEN_DOWNTIME)", () => {
  const r = applyLedgerEvent(started(), { kind: "DOWNTIME_END", at: T0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NO_OPEN_DOWNTIME");
});

test("machine state follows SETUP/RUN/CHANGEOVER/COMPLETE_JOB", () => {
  const seq: Array<[LedgerEvent, string]> = [
    [{ kind: "SETUP", at: T0 }, "SETUP"],
    [{ kind: "RUN", at: T0 }, "RUNNING"],
    [{ kind: "CHANGEOVER", at: T0 }, "SETUP"],
  ];
  let s = started();
  for (const [ev, want] of seq) {
    const r = applyLedgerEvent(s, ev);
    assert.equal(r.ok, true);
    if (r.ok) {
      s = r.state;
      assert.equal(s.machineState, want);
    }
  }
  const done = applyLedgerEvent(s, { kind: "COMPLETE_JOB", at: T0 });
  assert.equal(done.ok, true);
  if (done.ok) {
    assert.equal(done.state.machineState, "IDLE");
    assert.equal(done.state.openLog, null);
  }
});

test("counters after COMPLETE_JOB are rejected (log closed)", () => {
  const s = started();
  const done = applyLedgerEvent(s, { kind: "COMPLETE_JOB", at: T0 });
  assert.equal(done.ok, true);
  if (!done.ok) return;
  const late = applyLedgerEvent(done.state, { kind: "GOOD", qty: 1, at: T0 });
  assert.equal(late.ok, false);
  if (!late.ok) assert.equal(late.code, "NO_OPEN_LOG");
});

test("START_JOB while already running is rejected (ALREADY_RUNNING)", () => {
  const s = started();
  const r = applyLedgerEvent(s, { kind: "START_JOB", at: T0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ALREADY_RUNNING");
});
