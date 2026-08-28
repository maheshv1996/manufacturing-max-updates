"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { backupFileName, rotateBackups, createBackup, restoreBackup, exportVault, resolvePgTool } = require("../lib/vault");

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mfgmax-vault-test-"));
}

test("backupFileName is timestamped and unique", () => {
  const a = backupFileName(new Date("2026-08-10T20:00:05"));
  assert.match(a, /^mfgmax-20260810-200005\.dump$/);
  const b = backupFileName(new Date("2026-08-10T20:00:06"));
  assert.notStrictEqual(a, b);
});

test("rotateBackups keeps the last N", () => {
  const files = Array.from({ length: 40 }, (_, i) => `mfgmax-20260101-${String(i).padStart(6, "0")}.dump`);
  const removed = rotateBackups(files, 30);
  assert.strictEqual(removed.length, 10);
  assert.ok(removed[0].includes("000000"));
  assert.ok(!removed.includes(files[files.length - 1]));
  assert.strictEqual(rotateBackups(files, 50).length, 0);
});

test("createBackup copies a file DB and rotates", async () => {
  const dir = tmpdir();
  const dataDir = path.join(dir, "data");
  const backupsDir = path.join(dir, "backups");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "app.db"), "fake-db-content-v1");

  const r1 = await createBackup({ dataDir, backupsDir, keep: 30 });
  assert.match(r1.file, /\.dump$/);
  assert.ok(fs.existsSync(path.join(backupsDir, r1.file)));
  assert.strictEqual(fs.readFileSync(path.join(backupsDir, r1.file), "utf8"), "fake-db-content-v1");
  assert.strictEqual(r1.removed.length, 0);
});

test("createBackup rotates beyond keep", async () => {
  const dir = tmpdir();
  const dataDir = path.join(dir, "data");
  const backupsDir = path.join(dir, "backups");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(backupsDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "app.db"), "x");
  for (let i = 0; i < 35; i++) {
    fs.writeFileSync(path.join(backupsDir, backupFileName(new Date(Date.UTC(2026, 0, 1, 0, 0, i)))), "old");
  }
  const r = await createBackup({ dataDir, backupsDir, keep: 30 });
  assert.strictEqual(r.removed.length, 6); // 36 files - keep 30
  assert.strictEqual(fs.readdirSync(backupsDir).filter((f) => f.endsWith(".dump")).length, 30);
});

test("resolvePgTool prefers the bundled binary when it exists", () => {
  const dir = tmpdir();
  const binDir = path.join(dir, "pgbin");
  fs.mkdirSync(binDir, { recursive: true });
  const exe = process.platform === "win32" ? "pg_restore.exe" : "pg_restore";
  fs.writeFileSync(path.join(binDir, exe), "fake-binary");
  // Bundled binary present → absolute path to it (NOT the bare PATH name).
  assert.strictEqual(resolvePgTool("pg_restore", binDir), path.join(binDir, exe));
});

test("resolvePgTool falls back to PATH when the binary is missing", () => {
  const dir = tmpdir();
  const binDir = path.join(dir, "pgbin");
  fs.mkdirSync(binDir, { recursive: true });
  // No pg_restore bundled → bare name so PATH resolution applies.
  assert.strictEqual(resolvePgTool("pg_restore", binDir), "pg_restore");
  assert.strictEqual(resolvePgTool("pg_restore", undefined), "pg_restore");
});

test("restoreBackup throws when the dump file is missing", async () => {
  const dir = tmpdir();
  await assert.rejects(
    restoreBackup({ backupsDir: dir, dumpPath: "nope.dump", dataDir: dir, databaseUrl: "postgresql://x" }),
    /Backup file not found/
  );
});

test("exportVault copies the latest dump to the target drive", () => {
  const dir = tmpdir();
  const backupsDir = path.join(dir, "backups");
  const exportDir = path.join(dir, "pendrive");
  fs.mkdirSync(backupsDir, { recursive: true });
  fs.writeFileSync(path.join(backupsDir, "mfgmax-20260810-200000.dump"), "dump-1");
  fs.writeFileSync(path.join(backupsDir, "mfgmax-20260811-200000.dump"), "dump-2-latest");
  const r = exportVault({ backupsDir, exportDir });
  assert.deepStrictEqual(r.copied, ["mfgmax-20260811-200000.dump"]);
  assert.strictEqual(fs.readFileSync(path.join(exportDir, "mfgmax-20260811-200000.dump"), "utf8"), "dump-2-latest");
});
