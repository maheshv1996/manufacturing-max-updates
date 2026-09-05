import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  rotateEpoch,
  signSessionToken,
  verifySessionToken,
  buildSessionClaims,
} from "../src/lib/core/auth";

test("password hash round-trips and rejects wrong passwords", async () => {
  const hash = await hashPassword("Correct-Horse-9!");
  assert.notEqual(hash, "Correct-Horse-9!");
  assert.equal(await verifyPassword("Correct-Horse-9!", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
  assert.equal(await verifyPassword("Correct-Horse-9!", "garbage-hash"), false);
});

test("epoch rotation is strictly incrementing", () => {
  assert.equal(rotateEpoch(0), 1);
  assert.equal(rotateEpoch(7), 8);
});

test("session claims builder produces the exact payload shape", () => {
  const claims = buildSessionClaims({
    id: "u1",
    username: "ramesh",
    name: "Ramesh",
    roleId: "r1",
    roleName: "Operator",
    permissions: ["terminal.use", "ops.view"],
    isOwner: false,
    level: "WORKER",
    mustChangePassword: false,
    sess: 3,
  });
  assert.equal(claims.id, "u1");
  assert.deepEqual(claims.permissions, ["terminal.use", "ops.view"]);
  assert.equal(claims.isOwner, false);
  assert.equal(claims.sess, 3);
  assert.equal(claims.mustChangePassword, false);
});

test("sign/verify session token round-trips payload fields", async () => {
  const claims = buildSessionClaims({
    id: "u2",
    username: "sita",
    name: "Sita",
    roleId: "r2",
    roleName: "QC",
    permissions: ["quality.view"],
    isOwner: false,
    level: "MANAGER",
    mustChangePassword: true,
    sess: 5,
  });
  const token = await signSessionToken(claims);
  const decoded = await verifySessionToken(token);
  assert.ok(decoded, "token should verify");
  assert.equal(decoded!.id, "u2");
  assert.equal(decoded!.roleName, "QC");
  assert.equal(decoded!.sess, 5);
  assert.equal(decoded!.mustChangePassword, true);
});

test("tampered token fails verification", async () => {
  const claims = buildSessionClaims({
    id: "u3",
    username: "x",
    roleId: "r",
    roleName: "x",
    permissions: [],
    isOwner: false,
    level: "WORKER",
    mustChangePassword: false,
    sess: 0,
  });
  const token = await signSessionToken(claims);
  const tampered = token.slice(0, -2) + (token.endsWith("ab") ? "cd" : "ab");
  assert.equal(await verifySessionToken(tampered), null);
});
