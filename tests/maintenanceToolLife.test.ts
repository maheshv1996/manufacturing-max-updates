import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consumeUnits,
  regrind,
  scrap,
  wearPct,
  type MaintenanceToolInput,
} from "../src/lib/maintenance/toolLife";
import {
  recordCycles,
  cycleWearPct,
  type CycleToolInput,
} from "../src/lib/maintenance/toolLife";
import { isOk, isErr } from "../src/lib/core/result";

const tool = (overrides: Partial<MaintenanceToolInput> = {}): MaintenanceToolInput => ({
  id: "t1",
  code: "TL-001",
  ratedLifeUnits: 100,
  usedUnits: 0,
  regrinds: 0,
  maxRegrinds: 3,
  lifeStatus: "AVAILABLE",
  ...overrides,
});

// ------------------------------------------------------------- MaintenanceTool (units)

test("consume from AVAILABLE puts the tool IN_USE under rated life", () => {
  const r = consumeUnits(tool(), 40, new Date());
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.usedUnits, 40);
    assert.equal(r.value.lifeStatus, "IN_USE");
  }
});

test("consume crossing rated life flips to NEEDS_REGRIND", () => {
  const r = consumeUnits(tool(), 100, new Date());
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.lifeStatus, "NEEDS_REGRIND");
});

test("consume on a scrapped tool is refused", () => {
  const r = consumeUnits(tool({ lifeStatus: "SCRAPPED" }), 10, new Date());
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "SCRAPPED");
});

test("consume with non-positive units is INVALID", () => {
  const r = consumeUnits(tool(), 0, new Date());
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "INVALID_UNITS");
});

test("regrind resets used units and increments the counter", () => {
  const worn = tool({ usedUnits: 100, lifeStatus: "NEEDS_REGRIND", regrinds: 0 });
  const r = regrind(worn, { costRupees: 500, now: new Date() });
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.usedUnits, 0);
    assert.equal(r.value.regrinds, 1);
    assert.equal(r.value.lifeStatus, "AVAILABLE");
  }
});

test("regrind before NEEDS_REGRIND is REFUSE_REGRIND — no early resets", () => {
  const fresh = tool({ usedUnits: 20, lifeStatus: "AVAILABLE" });
  const r = regrind(fresh, { costRupees: 500, now: new Date() });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "REFUSE_REGRIND");
});

test("regrind at maxRegrinds forces SCRAP — mandatory replace", () => {
  const lastLife = tool({ usedUnits: 100, lifeStatus: "NEEDS_REGRIND", regrinds: 3, maxRegrinds: 3 });
  const r = regrind(lastLife, { costRupees: 500, now: new Date() });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "SCRAP_REQUIRED");
});

test("scrap from any non-scrapped state works", () => {
  const r = scrap(tool({ lifeStatus: "IN_USE" }), { reason: "Chipped edge", now: new Date() });
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.lifeStatus, "SCRAPPED");
});

test("wearPct computes percentage of rated life", () => {
  assert.equal(wearPct(tool({ usedUnits: 75 })), 75);
  assert.equal(wearPct(tool({ ratedLifeUnits: 200, usedUnits: 50 })), 25);
});

// ------------------------------------------------------------- Tool (cycles)

const cycleTool = (overrides: Partial<CycleToolInput> = {}): CycleToolInput => ({
  id: "ct1",
  toolCode: "FIX-01",
  maxLifeCycles: 1000,
  currentCycles: 0,
  warningThreshold: 85,
  status: "ACTIVE",
  ...overrides,
});

test("recordCycles accumulates and warns past the threshold", () => {
  const r1 = recordCycles(cycleTool(), 800, new Date());
  assert.equal(isOk(r1), true);
  if (isOk(r1)) assert.equal(r1.value.status, "ACTIVE");

  const r2 = recordCycles(cycleTool({ currentCycles: 800 }), 100, new Date()); // 90%
  assert.equal(isOk(r2), true);
  if (isOk(r2)) assert.equal(r2.value.status, "WARNING");
});

test("recordCycles at max life forces RETIRED", () => {
  const r = recordCycles(cycleTool({ currentCycles: 990 }), 10, new Date());
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.status, "RETIRED");
});

test("recordCycles on a retired tool is refused", () => {
  const r = recordCycles(cycleTool({ status: "RETIRED" }), 5, new Date());
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "RETIRED");
});

test("recordCycles with non-positive count is INVALID", () => {
  const r = recordCycles(cycleTool(), -3, new Date());
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "INVALID_CYCLES");
});

test("cycleWearPct caps at 100", () => {
  assert.equal(cycleWearPct(cycleTool({ currentCycles: 1200 })), 100);
});
