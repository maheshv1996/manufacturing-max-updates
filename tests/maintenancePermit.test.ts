import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approveLeg,
  voidPermit,
  isPermitValid,
  type PermitInput,
} from "../src/lib/maintenance/permit";
import { isOk, isErr } from "../src/lib/core/result";

const permit = (overrides: Partial<PermitInput> = {}): PermitInput => ({
  id: "p1",
  permitNo: "PTW-2026-001",
  type: "HOT_WORK",
  status: "PENDING",
  validFrom: new Date("2026-09-05T06:00:00Z"),
  validUntil: new Date("2026-09-05T18:00:00Z"),
  legs: {},
  ...overrides,
});

const approval = (by: string): { by: string; reason: string; at: Date } => ({ by, reason: "Safe to proceed", at: new Date("2026-09-05T05:00:00Z") });

test("approveLeg records the EHS leg", () => {
  const r = approveLeg(permit(), "EHS", { by: "ehs1", reason: "Fire watch posted", at: new Date() });
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.ok(r.value.legs.EHS);
});

test("approveLeg requires a written reason on every leg", () => {
  const r = approveLeg(permit(), "EHS", { by: "ehs1", reason: "  ", at: new Date() });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "REASON_REQUIRED");
});

test("permit is APPROVED only when all three legs are signed", () => {
  const one = approveLeg(permit(), "EHS", approval("ehs1"));
  if (!isOk(one)) throw new Error("ehs leg failed");
  const two = approveLeg(one.value, "MAINTENANCE", approval("m1"));
  if (!isOk(two)) throw new Error("maint leg failed");
  assert.equal(two.value.status, "PENDING"); // not yet
  const three = approveLeg(two.value, "PRODUCTION", approval("p1"));
  if (!isOk(three)) throw new Error("prod leg failed");
  assert.equal(three.value.status, "APPROVED");
  assert.ok(three.value.approvedAt);
});

test("approveLeg on APPROVED/VOID permit is illegal", () => {
  const done: PermitInput = { ...permit(), status: "APPROVED", approvedAt: new Date() };
  const r = approveLeg(done, "EHS", approval("x"));
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "ILLEGAL_TRANSITION");
});

test("voidPermit requires a reason and works from any live state", () => {
  const r1 = voidPermit(permit(), { by: "safety1", reason: "Wind gusts above limit", at: new Date() });
  assert.equal(isOk(r1), true);
  if (isOk(r1)) assert.equal(r1.value.status, "VOID");

  const approved: PermitInput = { ...permit(), status: "APPROVED", approvedAt: new Date() };
  const r2 = voidPermit(approved, { by: "safety1", reason: "Job cancelled", at: new Date() });
  assert.equal(isOk(r2), true);

  const noReason = voidPermit(permit(), { by: "safety1", reason: "", at: new Date() });
  assert.equal(isErr(noReason), true);
});

test("voided permit cannot be re-approved", () => {
  const voided: PermitInput = { ...permit(), status: "VOID", voidedAt: new Date() };
  const r = approveLeg(voided, "EHS", approval("x"));
  assert.equal(isErr(r), true);
});

test("isPermitValid: only APPROVED permits inside their window count", () => {
  const now = new Date("2026-09-05T10:00:00Z");
  assert.equal(isPermitValid({ ...permit(), status: "APPROVED", approvedAt: now }, now), true);
  assert.equal(isPermitValid({ ...permit(), status: "PENDING" }, now), false);
  assert.equal(isPermitValid({ ...permit(), status: "APPROVED", approvedAt: now }, new Date("2026-09-05T19:00:00Z")), false);
  assert.equal(isPermitValid({ ...permit(), status: "APPROVED", approvedAt: now }, new Date("2026-09-05T05:00:00Z")), false);
});
