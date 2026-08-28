"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { sign, verify, evaluateActivation, fingerprint } = require("../lib/license");

const SECRET = "test-secret";
const MACHINE = "machine-abc-123";
const FUTURE = new Date(Date.now() + 90 * 86400_000).toISOString();
const PAST = new Date(Date.now() - 10 * 86400_000).toISOString();

test("fingerprint is stable and 32 hex chars", () => {
  const a = fingerprint();
  const b = fingerprint();
  assert.strictEqual(a, b);
  assert.match(a, /^[0-9a-f]{32}$/);
});

test("sign + verify round-trips a valid key", () => {
  const key = sign({ plan: "plant-pro", expiresAt: FUTURE, machineId: MACHINE }, SECRET);
  const r = verify(key, SECRET);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.payload.plan, "plant-pro");
});

test("verify rejects tampered key", () => {
  const key = sign({ plan: "plant-pro", expiresAt: FUTURE, machineId: MACHINE }, SECRET);
  const parts = key.split(".");
  const tampered = parts[0].replace(/^./, "x") + "." + parts[1];
  const r = verify(tampered, SECRET);
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.reason, "BAD_SIGNATURE");
});

test("verify rejects wrong secret", () => {
  const key = sign({ plan: "x", expiresAt: FUTURE, machineId: MACHINE }, SECRET);
  assert.strictEqual(verify(key, "wrong-secret").valid, false);
});

test("evaluateActivation: ACTIVE for valid future key on same machine", () => {
  const key = sign({ plan: "plant-pro", expiresAt: FUTURE, machineId: MACHINE }, SECRET);
  const r = evaluateActivation({ key, secret: SECRET, machineId: MACHINE, firstSeenDate: new Date().toISOString() });
  assert.strictEqual(r.status, "ACTIVE");
});

test("evaluateActivation: EXPIRED when date passed", () => {
  const key = sign({ plan: "plant-pro", expiresAt: PAST, machineId: MACHINE }, SECRET);
  const r = evaluateActivation({ key, secret: SECRET, machineId: MACHINE, firstSeenDate: new Date().toISOString() });
  assert.strictEqual(r.status, "EXPIRED");
});

test("evaluateActivation: GRACE for machine change within 14 days", () => {
  const key = sign({ plan: "plant-pro", expiresAt: FUTURE, machineId: "other-machine" }, SECRET);
  const r = evaluateActivation({ key, secret: SECRET, machineId: MACHINE, firstSeenDate: new Date(Date.now() - 2 * 86400_000).toISOString() });
  assert.strictEqual(r.status, "GRACE");
});

test("evaluateActivation: INVALID after grace expired on machine change", () => {
  const key = sign({ plan: "plant-pro", expiresAt: FUTURE, machineId: "other-machine" }, SECRET);
  const r = evaluateActivation({ key, secret: SECRET, machineId: MACHINE, firstSeenDate: new Date(Date.now() - 30 * 86400_000).toISOString() });
  assert.strictEqual(r.status, "INVALID");
  assert.strictEqual(r.reason, "MACHINE_MISMATCH");
});

test("evaluateActivation: GRACE on first run without any key, INVALID after", () => {
  const firstSeen = new Date(Date.now() - 3 * 86400_000).toISOString();
  const during = evaluateActivation({ key: null, secret: SECRET, machineId: MACHINE, firstSeenDate: firstSeen });
  assert.strictEqual(during.status, "GRACE");
  const after = evaluateActivation({ key: null, secret: SECRET, machineId: MACHINE, firstSeenDate: new Date(Date.now() - 30 * 86400_000).toISOString() });
  assert.strictEqual(after.status, "INVALID");
});
