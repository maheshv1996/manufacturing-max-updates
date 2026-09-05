import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBreakdownMachines, type BreakdownScanInput } from "../src/lib/maintenance/breakdownScan";

const NOW = new Date("2026-09-05T06:00:00Z");
const HOUR = 60 * 60 * 1000;

const machine = (over: Partial<BreakdownScanInput> = {}): BreakdownScanInput => ({
  machineId: "m1",
  name: "CNC-01",
  faultState: true,
  hasOpenBreakdown: false,
  lastBreakdownClosedAt: null,
  ...over,
});

test("FAULT machine with no open breakdown is a candidate", () => {
  const r = detectBreakdownMachines([machine()], { now: NOW });
  assert.deepEqual(r.machineIds, ["m1"]);
  assert.equal(r.candidates.length, 1);
});

test("FAULT machine with an open breakdown is NOT re-created (no duplicate spam)", () => {
  const r = detectBreakdownMachines([machine({ hasOpenBreakdown: true })], { now: NOW });
  assert.equal(r.candidates.length, 0);
});

test("healthy machine is never a candidate", () => {
  const r = detectBreakdownMachines([machine({ faultState: false })], { now: NOW });
  assert.equal(r.candidates.length, 0);
});

test("cooldown suppresses re-opening within N minutes of a closed breakdown", () => {
  const r = detectBreakdownMachines(
    [machine({ lastBreakdownClosedAt: new Date(NOW.getTime() - 20 * 60 * 1000) })],
    { now: NOW, cooldownMinutes: 30 },
  );
  assert.equal(r.candidates.length, 0);
});

test("cooldown passes once past the window", () => {
  const r = detectBreakdownMachines(
    [machine({ lastBreakdownClosedAt: new Date(NOW.getTime() - 45 * 60 * 1000) })],
    { now: NOW, cooldownMinutes: 30 },
  );
  assert.equal(r.candidates.length, 1);
});

test("zero-cooldown (default) re-opens immediately after a closed breakdown", () => {
  const r = detectBreakdownMachines(
    [machine({ lastBreakdownClosedAt: new Date(NOW.getTime() - HOUR) })],
    { now: NOW },
  );
  assert.equal(r.candidates.length, 1);
});

test("mixed fleet: only FAULT-without-open candidates are returned in order", () => {
  const r = detectBreakdownMachines(
    [
      machine({ machineId: "m1" }),
      machine({ machineId: "m2", hasOpenBreakdown: true }),
      machine({ machineId: "m3", faultState: false }),
      machine({ machineId: "m4", faultState: true }),
    ],
    { now: NOW },
  );
  assert.deepEqual(r.machineIds, ["m1", "m4"]);
});