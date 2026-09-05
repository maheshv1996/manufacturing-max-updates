import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFiveSPct } from "../src/lib/lean/fiveS";

test("5S pct = round1(sum / (items*5) * 100), v1 parity", () => {
  assert.equal(computeFiveSPct([5, 5, 5, 5, 5]).tag, "ok");
  const full = computeFiveSPct([5, 5, 5, 5, 5]);
  if (full.tag === "ok") assert.equal(full.value, 100);
  const mixed = computeFiveSPct([5, 4, 3, 2, 1]);
  if (mixed.tag === "ok") assert.equal(mixed.value, 60);
  const rounding = computeFiveSPct([3, 4, 4, 5, 5, 5, 5, 5, 4, 3, 4, 5, 5, 4, 5]); // 66/75 = 88.0
  if (rounding.tag === "ok") assert.equal(rounding.value, 88);
});

test("5S rejects empty sets and out-of-range scores", () => {
  assert.equal(computeFiveSPct([]).tag, "err");
  assert.equal(computeFiveSPct([5, -1]).tag, "err");
  assert.equal(computeFiveSPct([5, 6]).tag, "err");
  assert.equal(computeFiveSPct([5, 2.5]).tag, "err");
});
