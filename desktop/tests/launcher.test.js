"use strict";
/**
 * Regression tests for the SESSION_SECRET fix (v1.0.4):
 * the launcher must hand the spawned standalone server a SESSION_SECRET,
 * otherwise signSessionToken throws and EVERY desktop login fails with
 * "An unexpected authentication error occurred.".
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DesktopApp, argValue } = require("../launcher");
const embeddedDb = require("../lib/embeddedDb");

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mfgmax-launcher-test-"));
}

test("ensureSessionSecret creates secrets.json and is stable across calls", () => {
  const dir = tmpdir();
  const app = new DesktopApp({ dataDir: dir });
  const first = app.sessionSecret;
  const again = app.ensureSessionSecret();
  assert.strictEqual(again, first);
  assert.ok(first.length >= 32, "secret should be at least 32 chars");
  assert.ok(fs.existsSync(app.sessionSecretPath()), "secrets.json should exist");
  const stored = JSON.parse(fs.readFileSync(app.sessionSecretPath(), "utf8"));
  assert.strictEqual(stored.sessionSecret, first);
});

test("ensureSessionSecret reuses a persisted secret across app instances", () => {
  const dir = tmpdir();
  const a = new DesktopApp({ dataDir: dir }).sessionSecret;
  const b = new DesktopApp({ dataDir: dir }).sessionSecret;
  assert.strictEqual(a, b, "sessions must survive app restarts");
});

test("ensureSessionSecret honors an explicit SESSION_SECRET env override", () => {
  const dir = tmpdir();
  process.env.SESSION_SECRET = "explicit-test-secret-0123456789abcdef";
  try {
    const app = new DesktopApp({ dataDir: dir });
    assert.strictEqual(app.sessionSecret, "explicit-test-secret-0123456789abcdef");
    assert.ok(!fs.existsSync(app.sessionSecretPath()), "no file needed when env provides the secret");
  } finally {
    delete process.env.SESSION_SECRET;
  }
});

test("a too-short persisted secret is replaced", () => {
  const dir = tmpdir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "secrets.json"), JSON.stringify({ sessionSecret: "short" }));
  const app = new DesktopApp({ dataDir: dir });
  assert.ok(app.sessionSecret.length >= 32);
  assert.notStrictEqual(app.sessionSecret, "short");
});

test("serverEnv includes SESSION_SECRET matching the persisted value", () => {
  const dir = tmpdir();
  const app = new DesktopApp({ dataDir: dir });
  const env = app.serverEnv();
  assert.strictEqual(env.SESSION_SECRET, app.sessionSecret);
  assert.strictEqual(env.ELECTRON_RUN_AS_NODE, "1");
  assert.strictEqual(env.PORT, "3000");
  assert.strictEqual(env.NODE_ENV, "production");
  assert.ok(env.DATABASE_URL && env.DATABASE_URL.length > 0);
});

test("serverEnv enables the auth proxy (AUTH_ENABLED=true)", () => {
  const dir = tmpdir();
  const app = new DesktopApp({ dataDir: dir });
  // Without this the proxy is disabled and NO session ever authorizes an API.
  assert.strictEqual(app.serverEnv().AUTH_ENABLED, "true");
});

test("physicalRestore rejects a folder that is not a pgdata backup", () => {
  const dir = tmpdir();
  const backupsDir = path.join(dir, "backups");
  const binDir = path.join(dir, "pgbin");
  fs.mkdirSync(backupsDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, "pg_ctl" + (process.platform === "win32" ? ".exe" : "")), "x");
  fs.mkdirSync(path.join(backupsDir, "pgdata-notreally"), { recursive: true });
  fs.writeFileSync(path.join(backupsDir, "pgdata-notreally", "README.txt"), "not a cluster");
  // No config.json → no embedded cluster → clear error before touching anything.
  assert.throws(
    () => embeddedDb.physicalRestore({ dataDir: dir, binDir, backupsDir, backupName: "pgdata-notreally", log: () => {} }),
    /no embedded cluster/
  );
});

test("CLI arg parsing never mistakes the action word for a flag value", () => {
  // Regression: `node launcher.js license` (no --data-dir) used to resolve the
  // data dir to the literal word "license" and created <cwd>/license/… — a
  // real project-root pollution bug on bare-action invocations.
  assert.strictEqual(argValue(["license"], "--data-dir"), undefined);
  assert.strictEqual(argValue(["start"], "--port"), undefined);
  assert.strictEqual(argValue(["export"], "--to"), undefined);
  assert.strictEqual(argValue(["backup", "--data-dir", "/tmp/d1"], "--data-dir"), "/tmp/d1");
  assert.strictEqual(argValue(["--data-dir", "/tmp/d1", "start"], "--data-dir"), "/tmp/d1");
  assert.strictEqual(argValue(["export", "--to", "/pendrive"], "--to"), "/pendrive");
});

test("physicalRestore validates the PG_VERSION marker before touching the live cluster", () => {
  const dir = tmpdir();
  const backupsDir = path.join(dir, "backups");
  const binDir = path.join(dir, "pgbin");
  fs.mkdirSync(backupsDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, "pg_ctl" + (process.platform === "win32" ? ".exe" : "")), "x");
  // Fake live cluster in config.json.
  const pgdataDir = path.join(dir, "pgdata");
  fs.mkdirSync(pgdataDir, { recursive: true });
  fs.writeFileSync(path.join(pgdataDir, "PG_VERSION"), "18");
  embeddedDb.writeConfig(dir, { url: "postgresql://mfgmax:pw@127.0.0.1:5432/mfgmax", password: "pw", pgdataDir, port: 5432, initialized: true });
  // Backup folder WITHOUT PG_VERSION → rejected before the live cluster is stopped.
  fs.mkdirSync(path.join(backupsDir, "pgdata-junk"), { recursive: true });
  assert.throws(
    () => embeddedDb.physicalRestore({ dataDir: dir, binDir, backupsDir, backupName: "pgdata-junk", log: () => {} }),
    /not a pgdata backup folder/
  );
  // Live cluster untouched (still has PG_VERSION).
  assert.ok(fs.existsSync(path.join(pgdataDir, "PG_VERSION")));
});
