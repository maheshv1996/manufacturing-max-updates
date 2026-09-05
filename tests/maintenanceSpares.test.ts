import { test } from "node:test";
import assert from "node:assert/strict";
import {
  issueSpare,
  receiveSpare,
  needsReorder,
  kitShortfall,
  type SparePartInput,
  type SpareKitLine,
} from "../src/lib/maintenance/spares";
import { isOk, isErr } from "../src/lib/core/result";

const spare = (overrides: Partial<SparePartInput> = {}): SparePartInput => ({
  id: "sp1",
  sku: "BRG-6204",
  name: "Bearing 6204",
  currentQty: 10,
  minQty: 3,
  reorderPoint: 5,
  leadTimeDays: 15,
  avgDailyUsage: 0.5,
  ...overrides,
});

test("issue decrements stock", () => {
  const r = issueSpare(spare(), 4);
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.currentQty, 6);
});

test("issue below zero is refused (no silent negatives)", () => {
  const r = issueSpare(spare({ currentQty: 2 }), 3);
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "INSUFFICIENT_STOCK");
});

test("issue with non-positive quantity is INVALID", () => {
  const r = issueSpare(spare(), 0);
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "INVALID_QTY");
});

test("receive adds stock", () => {
  const r = receiveSpare(spare(), 20);
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.currentQty, 30);
});

test("needsReorder: at/below reorder point flags procurement", () => {
  assert.equal(needsReorder(spare({ currentQty: 5 })).reorder, true);
  assert.equal(needsReorder(spare({ currentQty: 2 })).reorder, true);
  assert.equal(needsReorder(spare({ currentQty: 9 })).reorder, false);
});

test("needsReorder computes suggested qty to restore above the point", () => {
  const r = needsReorder(spare({ currentQty: 2, reorderPoint: 5, minQty: 3 }));
  assert.ok(r.suggestedQty && r.suggestedQty > 0);
});

test("kitShortfall: missing pieces listed when stock is short", () => {
  const kit: SpareKitLine[] = [
    { spare: spare({ id: "a", currentQty: 2 }), required: 4 },
    { spare: spare({ id: "b", currentQty: 10 }), required: 1 },
  ];
  const r = kitShortfall(kit);
  assert.equal(r.canIssue, false);
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].spareId, "a");
  assert.equal(r.missing[0].shortBy, 2);
});

test("kitShortfall: fully stocked kit can issue", () => {
  const kit: SpareKitLine[] = [{ spare: spare({ currentQty: 10 }), required: 2 }];
  const r = kitShortfall(kit);
  assert.equal(r.canIssue, true);
  assert.equal(r.missing.length, 0);
});
