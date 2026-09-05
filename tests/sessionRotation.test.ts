import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSessionExpired,
  needsRotation,
  rotateSession,
  refreshSession,
  type RotationPolicy,
  type RotationSession,
} from "../src/lib/sessionRotation";
import { isOk, isErr } from "../src/lib/core/result";
import { signSessionToken, verifySessionToken } from "../src/lib/auth";

const policy: RotationPolicy = { maxAgeHours: 24 };

function session(overrides: Partial<RotationSession> = {}): RotationSession {
  return {
    id: "u1",
    username: "alice",
    name: "Alice",
    roleId: "r1",
    roleName: "ops",
    permissions: ["ops.view"],
    isOwner: false,
    level: "WORKER",
    mustChangePassword: false,
    sess: 3,
    issuedAt: new Date("2026-09-05T10:00:00Z"),
    ...overrides,
  };
}

test("isSessionExpired: young session is valid", () => {
  const now = new Date("2026-09-05T16:00:00Z"); // 6h old
  assert.equal(isSessionExpired(session(), policy, now), false);
});

test("isSessionExpired: session past maxAge is expired", () => {
  const now = new Date("2026-09-06T11:00:00Z"); // 25h old
  assert.equal(isSessionExpired(session(), policy, now), true);
});

test("isSessionExpired: boundary age is expired (>=)", () => {
  const now = new Date("2026-09-06T10:00:00Z"); // exactly 24h
  assert.equal(isSessionExpired(session(), policy, now), true);
});

test("needsRotation: token epoch matching DB epoch is current", () => {
  assert.equal(needsRotation(3, 3), false);
});

test("needsRotation: any epoch mismatch (behind or ahead) requires rotation", () => {
  assert.equal(needsRotation(3, 4), true); // role/password change bumped the DB
  assert.equal(needsRotation(4, 3), true); // stale token replayed after rollback
});

test("rotateSession: current epoch reissues the same claims", () => {
  const r = rotateSession(session(), 3, policy);
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.action, "REISSUE");
    assert.equal(r.value.payload.id, "u1");
    assert.equal(r.value.payload.sess, 3);
    assert.deepEqual([...r.value.payload.permissions], ["ops.view"]);
    assert.ok(r.value.tokenExpiresAt > new Date("2026-09-05T10:00:00Z"));
  }
});

test("rotateSession: stale epoch (DB bumped) is refused — re-login required", () => {
  const r = rotateSession(session(), 4, policy);
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "EPOCH_STALE");
});

test("rotateSession: policy-expired session is refused", () => {
  const now = new Date("2026-09-06T11:00:00Z"); // 25h old
  const r = rotateSession(session(), 3, policy, now);
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "SESSION_EXPIRED");
});

test("refreshSession: current session yields a verifiable new JWT", async () => {
  const r = await refreshSession(session(), 3, policy);
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    const verified = await verifySessionToken(r.value.token);
    assert.ok(verified);
    assert.equal(verified?.id, "u1");
    assert.equal(verified?.sess, 3);
    assert.equal(verified?.username, "alice");
  }
});

test("refreshSession: stale epoch refuses without a token", async () => {
  const r = await refreshSession(session(), 5, policy);
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.equal(r.error, "EPOCH_STALE");
});

test("refreshSession round-trip: signed token carries the full payload", async () => {
  const claims = session({ permissions: ["ops.view", "people.edit"], level: "MANAGER" });
  const r = await refreshSession(claims, 3, policy);
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    const verified = await verifySessionToken(r.value.token);
    assert.ok(verified);
    assert.deepEqual(verified?.permissions, ["ops.view", "people.edit"]);
    assert.equal(verified?.level, "MANAGER");
  }
});

test("signSessionToken integration: expiry is honored by jose verify", async () => {
  const token = await signSessionToken(
    {
      id: "u1",
      username: "alice",
      roleId: "r1",
      roleName: "ops",
      permissions: ["ops.view"],
      isOwner: false,
      level: "WORKER",
      mustChangePassword: false,
      sess: 3,
    },
    "1s",
  );
  const verified = await verifySessionToken(token);
  assert.ok(verified);
});
