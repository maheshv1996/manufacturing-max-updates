import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSeats,
  scopeSatisfies,
  type RawAssignment,
} from "../src/lib/org/seat";

const now = new Date("2026-09-05T10:00:00Z");
const past = new Date("2026-01-01T00:00:00Z");
const future = new Date("2026-12-31T00:00:00Z");

function ra(partial: Partial<RawAssignment> & Pick<RawAssignment, "roleId" | "levelRank">): RawAssignment {
  return {
    id: partial.id ?? "a1",
    roleId: partial.roleId,
    rolePermissions: partial.rolePermissions ?? [],
    levelName: partial.levelName ?? "JUNIOR",
    levelRank: partial.levelRank,
    scope: partial.scope ?? "SELF",
    validFrom: partial.validFrom ?? past,
    validTo: partial.validTo ?? null,
    status: partial.status ?? "ACTIVE",
    actsForUserId: partial.actsForUserId ?? null,
  };
}

test("single active assignment yields its perms, rank and home seat", () => {
  const r = resolveSeats(
    [ra({ id: "s1", roleId: "r1", rolePermissions: ["ops.view", "ops.edit"], levelRank: 2, levelName: "JUNIOR" })],
    now,
  );
  assert.equal(r.seats.length, 1);
  assert.equal(r.perms.has("ops.view"), true);
  assert.equal(r.perms.size, 2);
  assert.equal(r.maxLevelRank, 2);
  assert.equal(r.homeSeat?.id, "s1");
});

test("multiple roles union perms and take the max level", () => {
  const r = resolveSeats(
    [
      ra({ id: "s1", roleId: "op", rolePermissions: ["ops.view"], levelRank: 2 }),
      ra({ id: "s2", roleId: "qa", rolePermissions: ["quality.view", "quality.edit"], levelRank: 4, levelName: "LEAD" }),
    ],
    now,
  );
  assert.equal(r.perms.has("ops.view"), true);
  assert.equal(r.perms.has("quality.edit"), true);
  assert.equal(r.perms.size, 3);
  assert.equal(r.maxLevelRank, 4);
  assert.equal(r.seats.length, 2);
});

test("expired or not-yet-valid or suspended assignments are excluded", () => {
  const r = resolveSeats(
    [
      ra({ id: "s1", roleId: "r", rolePermissions: ["ops.view"], levelRank: 1 }),
      ra({ id: "s2", roleId: "r", rolePermissions: ["supply.view"], levelRank: 1, validTo: new Date("2026-01-02T00:00:00Z") }),
      ra({ id: "s3", roleId: "r", rolePermissions: ["quality.view"], levelRank: 1, validFrom: future }),
      ra({ id: "s4", roleId: "r", rolePermissions: ["finance.view"], levelRank: 1, status: "SUSPENDED" }),
    ],
    now,
  );
  assert.deepEqual(r.seats.map((s) => s.id), ["s1"]);
});

test("ACTING assignment contributes perms and records actsFor", () => {
  const r = resolveSeats(
    [
      ra({ id: "s1", roleId: "r", rolePermissions: ["ops.view"], levelRank: 1 }),
      ra({
        id: "s2",
        roleId: "stk",
        rolePermissions: ["supply.view", "supply.edit"],
        levelRank: 3,
        status: "ACTING",
        actsForUserId: "user-storekeeper",
      }),
    ],
    now,
  );
  assert.equal(r.perms.has("supply.edit"), true);
  const acting = r.seats.find((s) => s.id === "s2");
  assert.equal(acting?.actsForUserId, "user-storekeeper");
  assert.equal(acting?.status, "ACTING");
});

test("scope ladder: broader grants satisfy narrower requirements, never the reverse", () => {
  assert.equal(scopeSatisfies("SELF", "SELF"), true);
  assert.equal(scopeSatisfies("TEAM", "SELF"), false); // self grant cannot see team records
  assert.equal(scopeSatisfies("TEAM", "UNIT"), true); // dept grant covers team records
  assert.equal(scopeSatisfies("PLANT", "UNIT"), false); // dept grant cannot see plant-scoped records
  assert.equal(scopeSatisfies("PLANT", "ALL"), true);
  assert.equal(scopeSatisfies("ALL", "ALL"), true);
});
