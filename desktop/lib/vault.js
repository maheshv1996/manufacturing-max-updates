"use strict";
/**
 * DATA VAULT (Phase 2)
 * --------------------
 * Backups support two backends:
 *   - file-copy: desktop edition with an embedded file DB (SQLite) — the
 *     whole DB file is copied. Simplest possible vault: backup == file copy.
 *   - pg_dump: Postgres (cloud or bundled). `pg_dump -Fc` custom format.
 *
 * Rotation keeps the last `keep` backups, oldest removed first, so an
 * unattended factory never fills its disk.
 *
 * Pure Node — no dependencies.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

function backupFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `mfgmax-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.dump`;
}

/**
 * Resolve a Postgres client tool binary. Prefers the bundled pgBin dir (the
 * embedded cluster — machines often have no Postgres tools on PATH), falls
 * back to a bare name resolved through PATH (external/cloud DB).
 * @param {"pg_dump"|"pg_restore"} name
 * @param {string} [binDir]
 * @returns {string} absolute path when the bundled binary exists, else the bare name
 */
function resolvePgTool(name, binDir) {
  if (!binDir) return name;
  const exe = process.platform === "win32" ? name + ".exe" : name;
  const bundled = path.join(binDir, exe);
  return fs.existsSync(bundled) ? bundled : name;
}

/**
 * @returns {string[]} paths that were removed (oldest beyond keep)
 */
function rotateBackups(files, keep = 30) {
  const sorted = files
    .filter((f) => /\.(dump|backup|db|sqlite)$/i.test(f))
    .sort((a, b) => a.localeCompare(b)); // timestamped names sort chronologically
  const removed = sorted.slice(0, Math.max(0, sorted.length - keep));
  return removed;
}

async function createBackup({ dataDir, backupsDir, databaseUrl, binDir, keep = 30, log = () => {} }) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const fileName = backupFileName();
  const dest = path.join(backupsDir, fileName);

  if (databaseUrl && databaseUrl.startsWith("postgres")) {
    // Postgres: pg_dump -Fc into the vault. Prefer the bundled binary when
    // binDir is given (embedded cluster), fall back to PATH (external PG).
    const pgDump = resolvePgTool("pg_dump", binDir);
    const { execFile } = require("child_process");
    await new Promise((resolve, reject) => {
      const proc = execFile(
        pgDump,
        ["--format=custom", "--file=" + dest, databaseUrl],
        { maxBuffer: 1024 * 1024 * 64 },
        (err) => (err ? reject(err) : resolve())
      );
      proc.on("error", reject);
    });
  } else {
    // File DB (SQLite desktop edition): copy the DB file.
    const candidates = [
      path.join(dataDir, "app.db"),
      path.join(dataDir, "app.sqlite"),
      path.join(dataDir, "data.db"),
    ];
    const src = candidates.find((c) => fs.existsSync(c));
    if (!src) throw new Error("No database file found in " + dataDir);
    fs.copyFileSync(src, dest);
  }

  // Rotate: remove the oldest beyond keep.
  const removed = rotateBackups(fs.readdirSync(backupsDir), keep);
  for (const f of removed) {
    try {
      fs.unlinkSync(path.join(backupsDir, f));
      log("removed old backup " + f);
    } catch {}
  }

  const sizeMb = Math.round((fs.statSync(dest).size / 1024 / 1024) * 10) / 10;
  log(`backup created: ${fileName} (${sizeMb} MB)`);
  return { file: fileName, sizeMb, removed };
}

async function restoreBackup({ backupsDir, dumpPath, dataDir, databaseUrl, binDir, log = () => {} }) {
  const full = path.isAbsolute(dumpPath) ? dumpPath : path.join(backupsDir, dumpPath);
  if (!fs.existsSync(full)) throw new Error("Backup file not found: " + full);

  if (databaseUrl && databaseUrl.startsWith("postgres")) {
    // pg_restore into the same DB (drop-and-recreate object ownership kept).
    // Prefer the bundled binary when binDir is given (embedded cluster — the
    // machine may not have Postgres tools on PATH), fall back to PATH.
    const pgRestore = resolvePgTool("pg_restore", binDir);
    const r = spawnSync(pgRestore, ["--clean", "--if-exists", "--no-owner", "--dbname=" + databaseUrl, full], { stdio: "ignore", windowsHide: true });
    if (r.status !== 0) throw new Error("pg_restore failed with status " + r.status);
  } else {
    // File DB: replace the live file (parent process should restart the
    // server after restore so no process holds the old inode).
    const candidates = [
      path.join(dataDir, "app.db"),
      path.join(dataDir, "app.sqlite"),
      path.join(dataDir, "data.db"),
    ];
    const src = candidates.find((c) => fs.existsSync(c));
    if (!src) throw new Error("No database file found in " + dataDir);
    fs.copyFileSync(full, src);
  }
  log("restore complete from " + dumpPath);
  return { restoredFrom: full };
}

/**
 * Copy the latest dump (plus any CSV export zip if present) to a chosen
 * drive — the "export vault to pendrive" flow for air-gapped sites.
 */
function exportVault({ backupsDir, exportDir, includeZips = false, log = () => {} }) {
  fs.mkdirSync(exportDir, { recursive: true });
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => /\.(dump|backup|db|sqlite)$/i.test(f))
    .sort();
  const latest = files[files.length - 1];
  if (!latest) throw new Error("No backups to export");

  const copied = [latest];
  fs.copyFileSync(path.join(backupsDir, latest), path.join(exportDir, latest));
  log("exported " + latest + " -> " + exportDir);

  if (includeZips) {
    const zips = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".zip")).sort();
    const latestZip = zips[zips.length - 1];
    if (latestZip) {
      fs.copyFileSync(path.join(backupsDir, latestZip), path.join(exportDir, latestZip));
      copied.push(latestZip);
      log("exported " + latestZip + " -> " + exportDir);
    }
  }
  return { copied };
}

module.exports = { backupFileName, rotateBackups, createBackup, restoreBackup, exportVault, resolvePgTool };
