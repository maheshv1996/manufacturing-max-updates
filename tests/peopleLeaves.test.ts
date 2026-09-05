import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionLeave, nextLeaveNumber } from "../src/lib/people/leaves";
import { isOk, isErr } from "../src/lib/core/result";

test("transitionLeave approves from PENDING", () => {
  const r = transitionLeave("PENDING", "APPROVE");
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.status, "APPROVED");
});

test("transitionLeave rejects from PENDING without reason", () => {
  const r = transitionLeave("PENDING", "REJECT");
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "REASON_REQUIRED");
});

test("transitionLeave rejects from PENDING with reason", () => {
  const r = transitionLeave("PENDING", "REJECT", "Insufficient balance");
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.status, "REJECTED");
});

test("transitionLeave cancels from PENDING", () => {
  const r = transitionLeave("PENDING", "CANCEL");
  assert.equal(isOk(r), true);
  if (isOk(r)) assert.equal(r.value.status, "CANCELLED");
});

test("transitionLeave blocks cancel from APPROVED", () => {
  const r = transitionLeave("APPROVED", "CANCEL");
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "ILLEGAL_TRANSITION");
});

test("transitionLeave blocks approve from APPROVED", () => {
  const r = transitionLeave("APPROVED", "APPROVE");
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "ILLEGAL_TRANSITION");
});

test("nextLeaveNumber returns YYYY-NNN format", () => {
  const n = nextLeaveNumber(new Date("2026-09-05"));
  assert.match(n, /^LV-2026-\d{3}$/);
});
