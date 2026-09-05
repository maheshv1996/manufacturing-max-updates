import { test } from "node:test";
import assert from "node:assert/strict";
import { projectProductionToolWear } from "../src/lib/maintenance/productionWear";
import type { CycleToolInput, MaintenanceToolInput } from "../src/lib/maintenance/toolLife";

const cycleTool = (over: Partial<CycleToolInput> = {}): CycleToolInput => ({
  id: "ct1",
  toolCode: "FIX-A",
  maxLifeCycles: 100,
  currentCycles: 0,
  warningThreshold: 85,
  status: "ACTIVE",
  ...over,
});

const unitTool = (over: Partial<MaintenanceToolInput> = {}): MaintenanceToolInput => ({
  id: "mt1",
  code: "DIE-B",
  ratedLifeUnits: 500,
  usedUnits: 0,
  regrinds: 0,
  maxRegrinds: 3,
  lifeStatus: "AVAILABLE",
  ...over,
});

const NOW = new Date("2026-09-05T06:00:00Z");

test("LOG_GOOD qty accumulates cycle wear and reaches WARNING at threshold", () => {
  const r = projectProductionToolWear({
    cycleTools: [cycleTool({ currentCycles: 80 })],
    unitTools: [],
    units: 10,
    now: NOW,
  });
  assert.equal(r.cycles.length, 1);
  assert.equal(r.cycles[0]!.currentCycles, 90);
  assert.equal(r.cycles[0]!.status, "WARNING");
  assert.equal(r.cycles[0]!.changed, true);
});

test("cycle tool RETIRES at max life (v2 engine parity, replaces v1 MAINTENANCE)", () => {
  const r = projectProductionToolWear({
    cycleTools: [cycleTool({ currentCycles: 95 })],
    unitTools: [],
    units: 10,
    now: NOW,
  });
  assert.equal(r.cycles[0]!.status, "RETIRED");
});

test("RETIRED cycle tools are skipped — never re-armed by production", () => {
  const r = projectProductionToolWear({
    cycleTools: [cycleTool({ currentCycles: 1, status: "RETIRED" })],
    unitTools: [],
    units: 10,
    now: NOW,
  });
  assert.equal(r.cycles.length, 0);
});

test("no-op when nothing changes (already at same count and status is kept ACtive)", () => {
  const r = projectProductionToolWear({
    cycleTools: [cycleTool()],
    unitTools: [unitTool()],
    units: 1,
    now: NOW,
  });
  assert.equal(r.cycles[0]!.currentCycles, 1);
  assert.equal(r.cycles[0]!.status, "ACTIVE");
  assert.equal(r.cycles[0]!.changed, true);
});

test("unit tool accumulates and flips NEEDS_REGRIND when crossing rated life", () => {
  const r = projectProductionToolWear({
    cycleTools: [],
    unitTools: [unitTool({ usedUnits: 495 })],
    units: 10,
    now: NOW,
  });
  assert.equal(r.units.length, 1);
  assert.equal(r.units[0]!.usedUnits, 505);
  assert.equal(r.units[0]!.lifeStatus, "NEEDS_REGRIND");
  assert.equal(r.units[0]!.crossedThreshold, true);
});

test("a NEEDS_REGRIND tool keeps consuming but never re-fires the crossing", () => {
  const r = projectProductionToolWear({
    cycleTools: [],
    unitTools: [unitTool({ usedUnits: 510, lifeStatus: "NEEDS_REGRIND" })],
    units: 10,
    now: NOW,
  });
  assert.equal(r.units.length, 1);
  assert.equal(r.units[0]!.usedUnits, 520);
  assert.equal(r.units[0]!.lifeStatus, "NEEDS_REGRIND");
  assert.equal(r.units[0]!.crossedThreshold, false, "no repeat crossing → no repeat ToolLifeLog alert");
});

test("SCRAPPED unit tools are skipped", () => {
  const r = projectProductionToolWear({
    cycleTools: [],
    unitTools: [unitTool({ lifeStatus: "SCRAPPED" })],
    units: 10,
    now: NOW,
  });
  assert.equal(r.units.length, 0);
});

test("IN_USE status persists below rated life (no false NEEDS_REGRIND)", () => {
  const r = projectProductionToolWear({
    cycleTools: [],
    unitTools: [unitTool({ usedUnits: 100, lifeStatus: "IN_USE" })],
    units: 50,
    now: NOW,
  });
  assert.equal(r.units[0]!.lifeStatus, "IN_USE");
  assert.equal(r.units[0]!.crossedThreshold, false);
});

test("mixed projection returns both families with per-row updates", () => {
  const r = projectProductionToolWear({
    cycleTools: [cycleTool(), cycleTool({ id: "ct2", toolCode: "FIX-B", status: "RETIRED" })],
    unitTools: [unitTool(), unitTool({ id: "mt2", code: "DIE-C", lifeStatus: "IN_USE", usedUnits: 300 })],
    units: 5,
    now: NOW,
  });
  assert.equal(r.cycles.length, 1, "only the active cycle tool updates");
  assert.equal(r.units.length, 2, "both active unit tools update");
  assert.equal(r.units[1]!.lifeStatus, "IN_USE");
  assert.equal(r.units[1]!.crossedThreshold, false);
});