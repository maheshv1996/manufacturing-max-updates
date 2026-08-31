"use strict";
/**
 * EMBEDDED POSTGRES (Desktop v1)
 * ------------------------------
 * Owns the local Postgres lifecycle for the offline installer:
 *
 *   - initCluster(): initdb a fresh cluster with a random superuser password
 *     (stored in <dataDir>/config.json — never on disk in plaintext elsewhere)
 *   - tcpReady(): pure-Node readiness poll (no pg_isready client tool needed)
 *   - applyInitialData(): first-run only — CREATE DATABASE, apply
 *     resources/schema.sql (prisma migrations concatenated at build time),
 *     then run the compiled seed (resources/seedbuild). Writes the
 *     `.initialized` marker so it never runs twice.
 *
 * No Postgres client tools (pg_dump/psql/pg_isready) are required at runtime
 * on machines where the binary is not shipped; everything talks to the server
 * through node-postgres from the standalone bundle. Backups prefer a logical
 * pg_dump -Fc (no downtime) and fall back to a physical pgdata copy when the
 * pg_dump binary is absent (see launcher.backupNow).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
const { spawnSync } = require("child_process");

const DEFAULT_PORT = 54329;
const APP_DB = "mfgmax";
const SUPERUSER = "mfgmax";

function configPath(dataDir) {
  return path.join(dataDir, "config.json");
}

function readConfig(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(configPath(dataDir), "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(dataDir, cfg) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(configPath(dataDir), JSON.stringify(cfg, null, 2));
  return cfg;
}

/**
 * initdb a fresh cluster if none exists. Returns { url, password, pgdataDir,
 * port, fresh }.
 */
function initCluster({ dataDir, binDir, port = DEFAULT_PORT, log = () => {} }) {
  const pgdataDir = path.join(dataDir, "pgdata");
  const existing = readConfig(dataDir);

  if (existing && existing.pgdataDir && fs.existsSync(path.join(existing.pgdataDir, "PG_VERSION"))) {
    log(`[db] cluster exists at ${existing.pgdataDir}`);
    return {
      url: existing.url,
      password: existing.password,
      pgdataDir: existing.pgdataDir,
      port: existing.port || DEFAULT_PORT,
      fresh: false,
    };
  }

  const password = crypto.randomBytes(18).toString("base64url");
  const pwFile = path.join(dataDir, ".pgpw");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(pwFile, password);

  log("[db] initializing cluster (initdb)…");
  const init = spawnSync(path.join(binDir, "initdb"), [
    "-D", pgdataDir,
    "-U", SUPERUSER,
    "--pwfile=" + pwFile,
    "-E", "UTF8",
    "--auth=scram-sha-256",
    "--no-locale",
  ], { stdio: "ignore", windowsHide: true, timeout: 120_000 });
  try {
    fs.unlinkSync(pwFile);
  } catch {}
  if (init.status !== 0) throw new Error("initdb failed with status " + init.status);

  // Explicitly configure port and listen_addresses in postgresql.conf to avoid colliding with any system Postgres
  const confPath = path.join(pgdataDir, "postgresql.conf");
  try {
    fs.appendFileSync(confPath, `\nport = ${port}\nlisten_addresses = '127.0.0.1'\n`);
  } catch {}

  const url = `postgresql://${SUPERUSER}:${encodeURIComponent(password)}@127.0.0.1:${port}/${APP_DB}`;
  const cfg = { url, password, pgdataDir, port, initialized: false, version: 1 };
  writeConfig(dataDir, cfg);
  log("[db] cluster initialized — config written (port " + port + ")");
  return { ...cfg, fresh: true };
}

/** Pure-Node TCP readiness poll — no pg_isready binary needed. */
function tcpReady(port, timeoutMs = 60_000, log = () => {}) {
  const start = Date.now();
  const attempt = () =>
    new Promise((resolve) => {
      const sock = net.connect({ host: "127.0.0.1", port });
      const done = (ok) => {
        sock.destroy();
        resolve(ok);
      };
      sock.once("connect", () => done(true));
      sock.once("error", () => done(false));
      sock.setTimeout(1500, () => done(false));
    });

  return (async () => {
    let ok = false;
    while (Date.now() - start < timeoutMs) {
      ok = await attempt();
      if (ok) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return ok;
  })();
}

/**
 * First-run data load: CREATE DATABASE, apply schema.sql, run the compiled
 * seed. Spawns `node` (the standalone bundle's node_modules resolves `pg`,
 * `@prisma/client`, `@prisma/adapter-pg` via NODE_PATH). Writes `.initialized`.
 */
function applyInitialData({
  dataDir,
  resourcesDir,
  standaloneDir,
  nodeBin = process.execPath,
  log = () => {},
}) {
  const cfg = readConfig(dataDir);
  if (!cfg) throw new Error("config.json missing — run initCluster first");
  if (cfg.initialized) {
    log("[db] initial data already applied — skipping");
    return false;
  }

  // The bundle lives INSIDE the standalone dir (desktop-seed) so plain
  // `require("pg")` / `require("@prisma/client")` resolve by walking up into
  // standalone/node_modules. Electron's node IGNORES NODE_PATH, so a separate
  // resources/seedbuild + NODE_PATH would never load in the packaged app.
  const seedDeploy = path.join(standaloneDir, "desktop-seed");
  const schemaFile = path.join(seedDeploy, "schema.sql");
  const seedDir = path.join(seedDeploy, "seedbuild");
  if (!fs.existsSync(schemaFile) || !fs.existsSync(path.join(seedDir, "prisma", "seed.js"))) {
    throw new Error("desktop-seed bundle missing (" + seedDeploy + ") — run scripts/build-desktop-resources.js");
  }

  // Superuser URL against the maintenance DB for CREATE DATABASE.
  const adminUrl = cfg.url.replace(new RegExp("/" + APP_DB + "$"), "/postgres");

  // ELECTRON_RUN_AS_NODE: under Electron, process.execPath is the app exe —
  // spawning it without this flag starts a second GUI instance instead of
  // running the script. The server spawn has the same flag (launcher.startServer).
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    DATABASE_URL: cfg.url,
    ADMIN_URL: adminUrl,
    APP_DB,
    SCHEMA_FILE: schemaFile,
    SEED_DIR: seedDir,
  };

  const setup = path.join(seedDeploy, "setup-db.js");
  log("[db] applying schema + seed (first run)…");
  const r = spawnSync(nodeBin, [setup], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 600_000 });
  if (r.status !== 0) {
    const errText = (r.stderr || r.stdout || "").toString().trim();
    throw new Error("initial data load failed with status " + r.status + (errText ? ": " + errText : ""));
  }

  writeConfig(dataDir, { ...cfg, initialized: true });
  log("[db] initial data complete (.initialized written)");
  return true;
}

/** Stop then restart the cluster around a physical backup — see launcher. */
function physicalBackup({ dataDir, binDir, backupsDir, keep = 30, log = () => {} }) {
  const cfg = readConfig(dataDir);
  if (!cfg || !fs.existsSync(path.join(cfg.pgdataDir, "PG_VERSION"))) {
    throw new Error("no embedded cluster found");
  }
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const dest = path.join(backupsDir, "pgdata-" + stamp);
  fs.mkdirSync(backupsDir, { recursive: true });

  const pgCtlName = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
  const pgCtl = path.join(binDir, pgCtlName);
  log("[db] stopping postgres for physical backup…");
  let stopStatus = spawnSync(pgCtl, ["-D", cfg.pgdataDir, "stop", "-m", "fast"], { stdio: "ignore", windowsHide: true, timeout: 60_000 }).status;
  if (stopStatus !== 0) throw new Error("pg_ctl stop failed (" + stopStatus + ")");

  try {
    fs.cpSync(cfg.pgdataDir, dest, { recursive: true });
  } finally {
    log("[db] restarting postgres…");
    spawnSync(pgCtl, ["-D", cfg.pgdataDir, "-l", path.join(dataDir, "logs", "postgres.log"), "start"], { stdio: "ignore", windowsHide: true, timeout: 60_000 });
  }

  const sizeMb = Math.round((dirSize(dest) / 1024 / 1024) * 10) / 10;

  // Rotate keep-last-N
  const backups = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith("pgdata-"))
    .sort()
    .reverse();
  const removed = backups.slice(keep);
  for (const f of removed) {
    try {
      fs.rmSync(path.join(backupsDir, f), { recursive: true, force: true });
      log("removed old backup " + f);
    } catch {}
  }

  return { file: path.basename(dest), sizeMb, removed: removed.length };
}

/**
 * Logical backup of the embedded cluster via `pg_dump -Fc` — consistent
 * snapshot with NO downtime (the server keeps running). Throws when the
 * pg_dump binary is not shipped so the caller can fall back to
 * physicalBackup. Drops a `mfgmax-<stamp>.dump` into backupsDir (same naming
 * as the data vault) and rotates keep-last-N.
 */
function logicalBackup({ databaseUrl, binDir, backupsDir, keep = 30, log = () => {} }) {
  const pgDump = path.join(binDir, process.platform === "win32" ? "pg_dump.exe" : "pg_dump");
  if (!fs.existsSync(pgDump)) throw new Error("pg_dump not found in " + binDir);

  fs.mkdirSync(backupsDir, { recursive: true });
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const file =
    `mfgmax-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.dump`;
  const dest = path.join(backupsDir, file);

  log("[db] logical pg_dump backup…");
  const r = spawnSync(
    pgDump,
    ["--format=custom", "--file=" + dest, databaseUrl],
    { stdio: "ignore", windowsHide: true, timeout: 600_000 }
  );
  if (r.status !== 0) {
    try {
      fs.unlinkSync(dest);
    } catch {}
    throw new Error("pg_dump failed with status " + r.status);
  }

  const sizeMb = Math.round((fs.statSync(dest).size / 1024 / 1024) * 10) / 10;

  // Rotate keep-last-N (logical dumps only; physical pgdata-* folders are
  // rotated by physicalBackup itself).
  const dumps = fs.readdirSync(backupsDir).filter((f) => f.startsWith("mfgmax-") && f.endsWith(".dump")).sort();
  const removed = dumps.slice(0, Math.max(0, dumps.length - keep));
  for (const f of removed) {
    try {
      fs.unlinkSync(path.join(backupsDir, f));
      log("removed old backup " + f);
    } catch {}
  }

  log(`backup created: ${file} (${sizeMb} MB, logical)`);
  return { file, sizeMb, removed: removed.length };
}

/**
 * Restore an embedded cluster from a PHYSICAL pgdata backup folder (the
 * output of physicalBackup / the fallback backup when pg_dump is not shipped).
 * Stops the cluster, swaps the live pgdata for the backup, restarts, and waits
 * for TCP readiness — mirrors physicalBackup's stop-copy-start lifecycle.
 * Throws if the backup folder does not look like a pgdata dir.
 */
function physicalRestore({ dataDir, binDir, backupsDir, backupName, log = () => {} }) {
  const cfg = readConfig(dataDir);
  if (!cfg || !fs.existsSync(path.join(cfg.pgdataDir, "PG_VERSION"))) {
    throw new Error("no embedded cluster found");
  }
  const src = path.isAbsolute(backupName) ? backupName : path.join(backupsDir, backupName);
  if (!fs.existsSync(path.join(src, "PG_VERSION"))) {
    throw new Error("not a pgdata backup folder: " + src);
  }

  const pgCtlName = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
  const pgCtl = path.join(binDir, pgCtlName);
  if (!fs.existsSync(pgCtl)) throw new Error("pg_ctl not found in " + binDir);

  log("[db] stopping postgres for physical restore…");
  const stopStatus = spawnSync(pgCtl, ["-D", cfg.pgdataDir, "stop", "-m", "fast"], { stdio: "ignore", windowsHide: true, timeout: 60_000 }).status;
  if (stopStatus !== 0) throw new Error("pg_ctl stop failed (" + stopStatus + ")");

  try {
    // Move the live data aside, swap in the backup, restart.
    const quarentine = cfg.pgdataDir + ".pre-restore-" + Date.now();
    fs.renameSync(cfg.pgdataDir, quarentine);
    try {
      fs.cpSync(src, cfg.pgdataDir, { recursive: true });
    } catch (e) {
      // Put the live data back so a failed copy never leaves the cluster down.
      try {
        fs.rmSync(cfg.pgdataDir, { recursive: true, force: true });
        fs.renameSync(quarentine, cfg.pgdataDir);
      } catch {}
      throw e;
    }
    log("[db] restarting postgres…");
    const startStatus = spawnSync(pgCtl, ["-D", cfg.pgdataDir, "-l", path.join(dataDir, "logs", "postgres.log"), "start"], { stdio: "ignore", windowsHide: true, timeout: 60_000 }).status;
    if (startStatus !== 0) throw new Error("pg_ctl start failed (" + startStatus + ")");
    // Best-effort cleanup of the quarantined live data.
    try {
      fs.rmSync(quarentine, { recursive: true, force: true });
    } catch {}
  } catch (e) {
    // If restart failed, try to bring the (old) data back up before throwing.
    try {
      spawnSync(pgCtl, ["-D", cfg.pgdataDir, "-l", path.join(dataDir, "logs", "postgres.log"), "start"], { stdio: "ignore", windowsHide: true, timeout: 60_000 });
    } catch {}
    throw e;
  }

  log("restore complete from " + src);
  return { restoredFrom: src };
}

function dirSize(dir) {
  let total = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) total += dirSize(p);
      else total += fs.statSync(p).size;
    }
  } catch {}
  return total;
}


/**
 * Logical restore of the embedded cluster via `pg_restore` from a custom format dump.
 */
function logicalRestore({ databaseUrl, binDir, backupFile, log = () => {} }) {
  const pgRestore = path.join(binDir, process.platform === "win32" ? "pg_restore.exe" : "pg_restore");
  if (!fs.existsSync(pgRestore)) throw new Error("pg_restore not found in " + binDir);
  if (!fs.existsSync(backupFile)) throw new Error("backup file not found: " + backupFile);

  log("[db] logical pg_restore from " + backupFile + "…");
  const r = spawnSync(
    pgRestore,
    ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname=" + databaseUrl, backupFile],
    { stdio: "ignore", windowsHide: true, timeout: 600_000 }
  );

  // pg_restore returns 0 on success, or 1 if warnings occurred (e.g. table didn't exist before clean)
  if (r.status !== 0 && r.status !== 1) {
    throw new Error("pg_restore failed with status " + r.status);
  }

  log("logical restore complete from " + backupFile);
  return { restoredFrom: backupFile };
}

module.exports = { initCluster, applyInitialData, tcpReady, physicalBackup, physicalRestore, logicalBackup, logicalRestore, readConfig, writeConfig, configPath, DEFAULT_PORT, APP_DB, SUPERUSER };
