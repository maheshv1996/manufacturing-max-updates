import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleSeatContext } from "../src/lib/org/seatContext";

const now = new Date("2026-09-05T10:00:00Z");

const levels = [
  { name: "TRAINEE", rank: 1 },
  { name: "JUNIOR", rank: 2 },
  { name: "SENIOR", rank: 3 },
  { name: "LEAD", rank: 4 },
];

const rows = [
  {
    id: "a1",
    userId: "u1",
    roleId: "r-op",
    orgUnitId: "unit-shop",
    levelName: "JUNIOR",
    scope: "UNIT",
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validTo: null,
    status: "ACTIVE",
    actsForUserId: null,
    role: { id: "r-op", name: "Operator", permissions: ["terminal.use", "ops.view"] },
  },
  {
    id: "a2",
    userId: "u1",
    roleId: "r-qa",
    orgUnitId: "unit-qc",
    levelName: "LEAD",
    scope: "PLANT",
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validTo: null,
    status: "ACTING",
    actsForUserId: "u-qa-lead",
    role: { id: "r-qa", name: "QA Lead", permissions: ["quality.view", "quality.approve"] },
  },
];

test("assemble: unions permissions, resolves level ranks and exposes role codes", () => {
  const ctx = assembleSeatContext(rows as never, levels, now);
  assert.equal(ctx.perms.has("ops.view"), true);
  assert.equal(ctx.perms.has("quality.approve"), true);
  assert.equal(ctx.maxLevelRank, 4);
  assert.ok(ctx.roleCodes.includes("Operator"));
  assert.ok(ctx.roleCodes.includes("QA Lead"));
  assert.equal(ctx.actsForUserId, "u-qa-lead");
});

test("assemble: drops assignments whose level name is unknown to the ladder", () => {
  const bad = [
    {
      ...rows[0],
      levelName: "GRAND_WIZARD",
    },
    ...rows,
  ];
  const ctx = assembleSeatContext(bad as never, levels, now);
  // The bad assignment contributes no rank and no perms.
  assert.equal(ctx.seats.length, 2);
  assert.equal(ctx.maxLevelRank, 4);
});
