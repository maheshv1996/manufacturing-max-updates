"use strict";
/**
 * DESKTOP LAUNCHER (Phase 1 + 2 + 4)
 * ----------------------------------
 * Orchestrates the offline edition:
 *   1. resolve data dir (selectable via --data-dir / MFGMAX_DATA_DIR)
 *   2. license gate (grace window on first run / hardware change)
 *   3. start the embedded DB (SQLite = nothing to spawn; Postgres = watchdog)
 *   4. prisma migrate deploy + seed-if-empty
 *   5. spawn the standalone Next server under a watchdog (auto-restart ≤5s,
 *      max 3 tries, then crash alert)
 *   6. daily 8 PM auto-backup into the data vault (keep last 30)
 *
 * Electron tray integration: the Electron main process calls the exported
 * functions below (backupNow / restoreFrom / exportToDrive / stop / health).
 * The CLI mode (`node launcher.js --data-dir ...`) is used for headless
 * testing on the build machine.
 *
 * Pure Node — no dependencies beyond the app's own runtime.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");
const { Watchdog } = require("./lib/watchdog");
const vault = require("./lib/vault");
const license = require("./lib/license");
const licenseOnline = require("./lib/licenseOnline");
const embeddedDb = require("./lib/embeddedDb");
const { ControlServer } = require("./lib/controlServer");
const { checkGitHubRelease } = require("./lib/updater");
const crypto = require("crypto");

let APP_VERSION = process.env.APP_VERSION || "";
if (!APP_VERSION) {
  try {
    APP_VERSION = require("../package.json").version;
  } catch {
    APP_VERSION = "1.0.0";
  }
}
// Public update channel: <owner>/<repo> of the releases repo (see
// scripts/publish-release.ps1). Env var GITHUB_UPDATE_REPO overrides the
// baked-in default. Packaged builds resolve ../package.json from the asar.
let UPDATE_REPO = "";
try {
  UPDATE_REPO = require("../package.json").updateRepo || "";
} catch {}
const LICENSES_DIR_NAME = "licenses";
const STATE_FILE_NAME = "activation-state.json";

function resolveDataDir(cliArg) {
  if (cliArg) return path.resolve(cliArg);
  if (process.env.MFGMAX_DATA_DIR) return path.resolve(process.env.MFGMAX_DATA_DIR);
  return path.join(os.homedir(), "MfgMaxData");
}

function resolveAppRoot() {
  // Priority: explicit env (electron main sets MFGMAX_APP_ROOT to the
  // packaged standalone dir), then Electron's resources dir, then the dev
  // layout (launcher.js in <install>/desktop, build at <install>/.next/standalone).
  if (process.env.MFGMAX_APP_ROOT) return path.resolve(process.env.MFGMAX_APP_ROOT);
  if (process.resourcesPath) {
    const p = path.join(process.resourcesPath, "standalone");
    if (fs.existsSync(p)) return p;
  }
  const here = __dirname;
  const candidates = [
    path.join(here, "..", ".next", "standalone"),
    path.join(here, "..", "server.js"), // copied into <install> root
  ];
  return candidates.find((c) => fs.existsSync(c)) || path.join(here, "..", ".next", "standalone");
}

function resolveResourcesDir() {
  if (process.env.MFGMAX_RESOURCES_DIR) return path.resolve(process.env.MFGMAX_RESOURCES_DIR);
  if (process.resourcesPath) return path.join(process.resourcesPath, "resources");
  const root = path.join(__dirname, "..");
  return path.join(root, "resources");
}

class DesktopApp {
  constructor({ dataDir, port = 3000, licenseKey = process.env.MFGMAX_LICENSE, licenseSecret = process.env.MFGMAX_LICENSE_SECRET, log = console.log }) {
    this.dataDir = resolveDataDir(dataDir);
    this.port = port;
    this.licenseKey = licenseKey;
    this.licenseSecret = licenseSecret || "dev-secret-change-me";
    this.log = log;

    // Embedded Postgres config (desktop v1) — loaded from <dataDir>/config.json.
    this.dbConfig = null;
    try {
      const cfg = JSON.parse(fs.readFileSync(embeddedDb.configPath(this.dataDir), "utf8"));
      if (cfg && cfg.url) this.dbConfig = cfg;
    } catch {}
    this.pgBinDir = process.env.POSTGRES_BIN_DIR || "";

    this.dir = {
      data: this.dataDir,
      backups: path.join(this.dataDir, "backups"),
      licenses: path.join(this.dataDir, LICENSES_DIR_NAME),
      logs: path.join(this.dataDir, "logs"),
    };

    this.serverWatchdog = null;
    this.dbWatchdog = null;
    this.backupTimer = null;
    this.pruneTimer = null;
    this.integritySweep = null;
    this.controlServer = null;
    // The standalone server signs/verifies session JWTs with SESSION_SECRET
    // (getSecretKey() THROWS without it) — without this every desktop login
    // fails with "An unexpected authentication error occurred.". Persist a
    // generated secret in the data dir so sessions also survive restarts.
    this.sessionSecret = this.ensureSessionSecret();
    this.controlToken = process.env.MFGMAX_CONTROL_TOKEN || crypto.randomBytes(24).toString("hex");
    this.controlPort = Number(process.env.MFGMAX_CONTROL_PORT || 41841);
    // GitHub-direct update channel: <owner>/<repo> of the public releases repo.
    this.githubRepo = process.env.GITHUB_UPDATE_REPO || UPDATE_REPO;
    this.githubApiBase = process.env.GITHUB_API_BASE || "https://api.github.com";
    this.state = {
      server: "stopped",
      db: "stopped",
      lastBackup: null,
      license: null,
    };
  }

  ensureDirs() {
    for (const d of Object.values(this.dir)) fs.mkdirSync(d, { recursive: true });
  }

  /**
   * SESSION_SECRET for the spawned standalone server. Priority:
   *   1. process.env.SESSION_SECRET (dev / explicit override)
   *   2. persisted <dataDir>/secrets.json (created on first run, mode 0600)
   * Returns the same value on every boot so sessions stay valid.
   */
  ensureSessionSecret() {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    const p = path.join(this.dataDir, "secrets.json");
    try {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
      if (parsed && typeof parsed.sessionSecret === "string" && parsed.sessionSecret.length >= 32) {
        return parsed.sessionSecret;
      }
    } catch {}
    const secret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ sessionSecret: secret }, null, 2), { mode: 0o600 });
    return secret;
  }

  sessionSecretPath() {
    return path.join(this.dataDir, "secrets.json");
  }

  /** Env object handed to the spawned standalone server (testable). */
  serverEnv() {
    return {
      // Electron main runs this with ELECTRON_RUN_AS_NODE so process.execPath
      // (electron.exe) acts as plain node for the standalone server.
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(this.port),
      HOSTNAME: "0.0.0.0",
      DATABASE_URL: this.databaseUrl(),
      DESKTOP_MODE: "true",
      BACKUP_DIR: this.dir.backups,
      LOG_DIR: this.dir.logs,
      APP_VERSION,
      SESSION_SECRET: this.sessionSecret,
      // Auth proxy gate — dev gets this from .env; the launcher never loads
      // .env, so without this the proxy is disabled and NO session ever
      // authorizes an API (every protected route 401s). Desktop always wants auth.
      AUTH_ENABLED: "true",
      NODE_ENV: "production",
      MFGMAX_CONTROL_TOKEN: this.controlToken,
      MFGMAX_CONTROL_PORT: String(this.controlPort),
      GITHUB_UPDATE_REPO: this.githubRepo,
      GITHUB_API_BASE: this.githubApiBase,
      // Kiosk LAN gate — if set, proxy requires x-kiosk-token on /api/operator|terminal|ipcc
      // Pass through from host env so offline LAN can be locked down without a cloud.
      ...(process.env.MFGMAX_KIOSK_TOKEN ? { MFGMAX_KIOSK_TOKEN: process.env.MFGMAX_KIOSK_TOKEN } : {}),
      ...(process.env.KIOSK_TOKEN ? { KIOSK_TOKEN: process.env.KIOSK_TOKEN } : {}),
    };
  }

  // -------------------------------------------------------------------------
  // LICENSING
  // -------------------------------------------------------------------------
  activationStatePath() {
    return path.join(this.dir.licenses, STATE_FILE_NAME);
  }

  readFirstSeen() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.activationStatePath(), "utf8"));
      return raw.firstSeenAt || null;
    } catch {
      return null;
    }
  }

  writeFirstSeen() {
    const now = new Date().toISOString();
    fs.mkdirSync(this.dir.licenses, { recursive: true });
    fs.writeFileSync(this.activationStatePath(), JSON.stringify({ firstSeenAt: now }, null, 2));
    return now;
  }

  evaluateLicense() {
    const machineId = license.fingerprint();
    const firstSeen = this.readFirstSeen() || this.writeFirstSeen();
    const result = license.evaluateActivation({
      key: this.licenseKey,
      secret: this.licenseSecret,
      machineId,
      firstSeenDate: firstSeen,
      now: Date.now(),
      graceDays: 14,
    });
    this.state.license = result;
    this.log(`[license] ${result.status} (${result.reason}) machine=${machineId.slice(0, 8)}…`);
    // Advisory online re-verify (optional; offline NEVER gates). Fired without
    // awaiting so a slow/vacant network never delays boot.
    this.onlineLicenseRecheck().catch(() => {});
    return result;
  }

  /**
   * Optional online license re-verify when internet exists. Purely advisory:
   * the offline evaluateActivation result is the gate, so GRACE is preserved
   * and offline operation never blocks login. Unset MFGMAX_LICENSE_SERVER =>
   * disabled silently.
   */
  async onlineLicenseRecheck() {
    const serverUrl = process.env.MFGMAX_LICENSE_SERVER;
    if (!serverUrl) return;
    const result = await licenseOnline.reVerifyOnline({
      serverUrl,
      key: this.licenseKey,
      machineId: license.fingerprint(),
      timeoutMs: 5000,
    });
    this.state.licenseOnline = { checkedAt: new Date().toISOString(), ...result };
    if (result.offline) {
      this.log(`[license] online re-verify unavailable (${result.reason}) — offline gate unchanged`);
    } else if (result.ok) {
      this.log(`[license] online re-verify: ${result.status} (${result.reason}) — advisory only, offline gate unchanged`);
    } else {
      this.log(`[license] online re-verify: ${result.reason} — offline gate unchanged`);
    }
  }

  // -------------------------------------------------------------------------
  // DATABASE
  // -------------------------------------------------------------------------
  databaseUrl() {
    // Embedded Postgres (desktop v1) wins; then explicit env; then file DB.
    if (this.dbConfig?.url) return this.dbConfig.url;
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    return `file:${path.join(this.dataDir, "app.db")}`;
  }

  startDb() {
    const url = this.databaseUrl();
    if (url.startsWith("postgres")) {
      // Bundled Postgres: spawn the server binary via watchdog.
      const binDir = this.pgBinDir || process.env.POSTGRES_BIN_DIR;
      const pgdata = this.dbConfig?.pgdataDir || path.join(this.dataDir, "pgdata");
      if (!binDir) {
        this.log("[db] POSTGRES_BIN_DIR not set — assuming external Postgres is running.");
        this.state.db = "external";
        return;
      }
      const pgCtlName = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
      const pgBin = path.join(binDir, pgCtlName);
      if (!fs.existsSync(pgBin)) {
        this.log("[db] pg_ctl not found at " + pgBin);
        this.state.db = "error";
        return;
      }
      // pg_ctl start daemonizes the postmaster and returns. `-w` is NOT used:
      // its readiness wait is unreliable on Windows first boot (it gives up
      // while postgres is still recovering from a startup worker flake). The
      // TCP poll in waitForDbReady is the source of truth instead.
      // If a postmaster for THIS cluster already runs (previous session that
      // crashed without stopping it), reuse it rather than double-binding.
      const status = spawnSync(pgBin, ["-D", pgdata, "status"], { timeout: 15_000, stdio: "ignore" });
      if (status.status === 0) {
        this.log("[db] postgres already running (recovered from previous session)");
        this.state.db = "running";
        return;
      }
      this.log(`[db] starting postgres on port ${this.dbConfig?.port || embeddedDb.DEFAULT_PORT} (${pgBin})…`);
      const port = this.dbConfig?.port || embeddedDb.DEFAULT_PORT;
      // windowsHide: true + stdio ignore keeps the postmaster out of a visible
      // console — otherwise a console window pops up on the desktop and a
      // Ctrl+C / console-close reaches the postmaster (0xC000013A fast
      // shutdown), taking the DB down. Output already goes to -l <log>.
      const started = spawnSync(pgBin, ["-D", pgdata, "-o", `-p ${port}`, "-l", path.join(this.dir.logs, "postgres.log"), "start"], {
        stdio: "ignore",
        windowsHide: true,
        timeout: 60_000,
      });
      if (started.status !== 0) {
        // pg_ctl's report is unreliable here — the postmaster often comes up
        // fine anyway. waitForDbReady decides. Log the server log tail to help.
        this.log("[db] pg_ctl start reported failure (status " + started.status + ") — waiting for TCP readiness anyway; tail of postgres.log:");
        try {
          const tail = fs.readFileSync(path.join(this.dir.logs, "postgres.log"), "utf8").split(/\r?\n/).slice(-6).join("\n");
          this.log(tail || "(empty log)");
        } catch {}
      }
      this.state.db = "starting";
    } else {
      this.state.db = "file";
    }
  }

  async waitForDbReady(timeoutMs = 60_000) {
    const url = this.databaseUrl();
    if (!url.startsWith("postgres")) return true; // file DB always "ready"
    const port = this.dbConfig?.port || embeddedDb.DEFAULT_PORT;
    this.log(`[db] waiting for postgres on 127.0.0.1:${port}…`);
    return embeddedDb.tcpReady(port, timeoutMs, this.log);
  }

  /**
   * electron-builder's extraResources drops dot-dirs and node_modules, so the
   * build script renames them (.next -> nextdir, node_modules -> modules).
   * Restore the names before anything touches the standalone. Idempotent.
   */
  restorePackagedNames() {
    const root = resolveAppRoot();
    const renames = [
      ["nextdir", ".next"],
      ["modules", "node_modules"],
    ];
    for (const [from, to] of renames) {
      const fromP = path.join(root, from);
      const toP = path.join(root, to);
      try {
        if (fs.existsSync(fromP) && !fs.existsSync(toP)) {
          fs.renameSync(fromP, toP);
          this.log(`[packaging] restored ${from} -> ${to}`);
        }
      } catch (e) {
        this.log(`[packaging] rename ${from} failed: ${e.message}`);
      }
    }
  }

  /** Desktop v1: initdb a fresh embedded cluster if needed. */
  ensureEmbeddedDb() {
    if (!this.pgBinDir && !process.env.POSTGRES_BIN_DIR) {
      this.log("[db] POSTGRES_BIN_DIR not set — skipping embedded init (external/file DB).");
      return null;
    }
    const binDir = this.pgBinDir || process.env.POSTGRES_BIN_DIR;
    const result = embeddedDb.initCluster({ dataDir: this.dataDir, binDir, port: embeddedDb.DEFAULT_PORT, log: this.log });
    this.dbConfig = result;
    return result;
  }

  /** Desktop v1: apply schema + seed on the very first run only. */
  applyInitialDataIfNeeded() {
    if (!this.dbConfig?.url || !this.dbConfig.url.startsWith("postgres")) return false;
    if (this.dbConfig.initialized) {
      this.log("[db] initial data already present — skipping first-run load");
      return false;
    }
    this.restorePackagedNames();
    const root = resolveAppRoot();
    return embeddedDb.applyInitialData({
      dataDir: this.dataDir,
      resourcesDir: resolveResourcesDir(),
      standaloneDir: root,
      nodeBin: process.execPath,
      log: this.log,
    });
  }

  runMigrations() {
    const root = resolveAppRoot();
    this.log("[db] running migrations…");
    // Prefer the app's bundled prisma; fall back to npx for dev layout.
    const prismaBin = path.join(root, "node_modules", ".bin", "prisma");
    const bin = fs.existsSync(prismaBin) ? prismaBin : "npx";
    const args = fs.existsSync(prismaBin) ? ["migrate", "deploy"] : ["prisma", "migrate", "deploy"];
    const r = spawnSync(bin, args, {
      cwd: root,
      env: { ...process.env, DATABASE_URL: this.databaseUrl() },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 180_000,
    });
    if (r.status !== 0) {
      const tail = (r.stderr || r.stdout || "").toString().split(/\r?\n/).slice(-8).join("\n");
      throw new Error("prisma migrate deploy failed (status " + r.status + "):\n" + tail);
    }
    this.log("[db] migrations complete");
  }

  seedIfEmpty() {
    const url = this.databaseUrl();
    let count = 0;
    try {
      if (url.startsWith("postgres")) {
        const r = spawnSync("psql", ["-d", url, "-tAc", "SELECT count(*) FROM \"User\";"], { stdio: "ignore" });
        count = parseInt(String(r.stdout || "0"), 10) || 0;
      } else {
        const sqlite = require("./lib/sqliteSeedCheck");
        count = sqlite.countUsers(this.dataDir);
      }
    } catch {
      count = 0;
    }
    if (count > 0) {
      this.log(`[db] seed skipped (${count} users present)`);
      return false;
    }
    this.log("[db] seeding…");
    const root = resolveAppRoot();
    const prismaBin = path.join(root, "node_modules", ".bin", "prisma");
    const bin = fs.existsSync(prismaBin) ? prismaBin : "npx";
    const args = fs.existsSync(prismaBin) ? ["db", "seed"] : ["prisma", "db", "seed"];
    const r = spawnSync(bin, args, {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 300_000,
    });
    if (r.status !== 0) {
      const tail = (r.stderr || r.stdout || "").toString().split(/\r?\n/).slice(-8).join("\n");
      throw new Error("seed failed (status " + r.status + "):\n" + tail);
    }
    this.log("[db] seed complete");
    return true;
  }

  // -------------------------------------------------------------------------
  // SERVER
  // -------------------------------------------------------------------------
  verifyBuild(root) {
    // Fail fast if the build the server would serve references assets missing
    // on disk (the stale-manifest failure that makes the whole app render
    // unstyled). Mirrors scripts/verify-build.js but self-contained so the
    // installer never depends on packaging that script.
    try {
      const buildIdPath = path.join(root, ".next", "BUILD_ID");
      if (!fs.existsSync(buildIdPath)) {
        this.log("[verify-build] .next/BUILD_ID missing — refusing to start");
        return false;
      }
      const missing = new Set();
      const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith(".html")) {
            const html = fs.readFileSync(p, "utf8");
            const refs = html.match(/\/_next\/static\/[^"')\s]+/g) || [];
            for (const ref of refs) {
              // Strip escaped-quote artifacts (e.g. `js\\` from inline JS) and
              // only consider real asset references.
              const clean = ref.replace(/[\\?].*$/, "");
              if (!/\.(js|css|woff2?|ttf|png|svg|jpe?g|gif|webp|ico)$/.test(clean)) continue;
              const disk = path.join(root, ".next", clean.replace(/^\/_next\/static\//, "static/"));
              if (!fs.existsSync(disk)) missing.add(clean);
            }
          }
        }
      };
      walk(path.join(root, ".next", "server", "app"));
      if (missing.size > 0) {
        this.log(`[verify-build] ${missing.size} asset(s) missing — stale/inconsistent build, refusing to start`);
        for (const m of [...missing].slice(0, 5)) this.log("   " + m);
        return false;
      }
      return true;
    } catch (err) {
      this.log("[verify-build] check failed: " + (err && err.message));
      return false;
    }
  }

  startServer() {
    const root = resolveAppRoot();
    this.restorePackagedNames();
    const serverJs = path.join(root, "server.js");
    if (!this.verifyBuild(root)) {
      this.log("[server] build verification failed — restart the launcher after rebuilding.");
      return false;
    }
    if (!fs.existsSync(serverJs)) {
      this.log("[server] standalone server.js not found at " + serverJs);
      this.log("[server] (run `npm run build` first — output:standalone produces .next/standalone)");
      return false;
    }
    this.serverWatchdog = new Watchdog({
      name: "server",
      command: process.execPath,
      args: [serverJs],
      cwd: root,
      env: this.serverEnv(),
      log: this.log,
      onCrash: () => {
        this.state.server = "crashed";
        this.notifyTray("Server crashed after 3 restart tries — manual intervention needed");
      },
    });
    this.serverWatchdog.start();
    this.state.server = "running";
    return true;
  }

  stop() {
    if (this._stopping) return;
    this._stopping = true;
    this.serverWatchdog?.stop();
    this.serverWatchdog = null;
    if (this.dbWatchdog) {
      clearInterval(this.dbWatchdog);
      this.dbWatchdog = null;
    }
    this.stopDb();
    this.controlServer?.stop();
    this.controlServer = null;
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    if (this.integritySweep) this.integritySweep.stop();
    this.integritySweep = null;
    this.state.server = "stopped";
    this.state.db = "stopped";
    this.log("[app] stopped");
  }

  stopDb() {
    const url = this.databaseUrl();
    if (!url.startsWith("postgres")) return;
    const binDir = this.pgBinDir || process.env.POSTGRES_BIN_DIR;
    const pgdata = this.dbConfig?.pgdataDir || path.join(this.dataDir, "pgdata");
    if (!binDir) return;
    const pgCtlName = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
    const pgBin = path.join(binDir, pgCtlName);
    try {
      this.log("[db] stopping postgres…");
      spawnSync(pgBin, ["-D", pgdata, "stop", "-m", "fast"], { stdio: "ignore", windowsHide: true, timeout: 60_000 });
    } catch (e) {
      this.log("[db] stop postgres: " + e.message);
    }
  }

  /**
   * Postgres is daemonized by pg_ctl (not a child we own), so if it dies the
   * server just 500s and the UI white-screens. A lightweight watchdog TCP-pings
   * the port and restarts the cluster so a transient outage self-heals within
   * a few seconds instead of wedging the app.
   */
  startDbWatchdog(intervalMs = 10_000) {
    if (!this.dbConfig?.url?.startsWith("postgres") || this.dbWatchdog) return;
    const port = this.dbConfig.port || embeddedDb.DEFAULT_PORT;
    this.log(`[db] watchdog armed (ping 127.0.0.1:${port} every ${intervalMs}ms)`);
    this.dbWatchdog = setInterval(async () => {
      if (this.state.server === "stopped" || this.state.db === "stopped") return;
      try {
        // TCP connect only — no startup packet, so a down postmaster never
        // blocks here and a healthy one isn't given a client backend.
        if (await embeddedDb.tcpReady(port, 3_000, () => {})) return;
      } catch {
        /* treat as down */
      }
      this.log("[db] watchdog: postgres unreachable — restarting…");
      this.state.db = "starting";
      try {
        this.startDb();
      } catch (e) {
        this.log("[db] watchdog restart failed: " + e.message);
        this.state.db = "error";
        return;
      }
      const ok = await this.waitForDbReady(30_000);
      this.state.db = ok ? "running" : "error";
      this.log(ok ? "[db] watchdog: postgres recovered" : "[db] watchdog: postgres failed to recover");
    }, intervalMs);
    this.dbWatchdog.unref?.();
  }

  // -------------------------------------------------------------------------
  // UPDATE CHANNEL
  // -------------------------------------------------------------------------
  async startControlServer() {
    this.controlServer = new ControlServer({
      app: this,
      token: this.controlToken,
      repo: this.githubRepo,
      apiBase: this.githubApiBase,
      controlPort: this.controlPort,
      version: APP_VERSION,
      log: this.log,
    });
    try {
      await this.controlServer.start();
    } catch (err) {
      this.log("[control] could not bind control port " + this.controlPort + ": " + err.message);
    }
  }

  async silentUpdateCheck() {
    try {
      const r = await checkGitHubRelease({ repo: this.githubRepo, apiBase: this.githubApiBase, currentVersion: APP_VERSION, timeoutMs: 5000 });
      if (!r.offline && r.updateAvailable) {
        this.log(`[update] version ${r.latest} available (${r.sizeMb} MB) — tray: Check for Updates`);
      } else if (r.offline) {
        this.log("[update] offline — updates will use Update from File");
      } else {
        this.log("[update] up to date (" + APP_VERSION + ")");
      }
    } catch {
      this.log("[update] check skipped (offline)");
    }
  }

  // -------------------------------------------------------------------------
  // VAULT (called from tray: Backup Now / Restore / Export)
  // -------------------------------------------------------------------------
  async backupNow() {
    // Embedded Postgres: prefer a logical pg_dump -Fc (consistent snapshot,
    // zero downtime). If the pg_dump binary is not shipped in this build,
    // fall back to a physical pgdata copy (brief stop-copy-restart).
    if (this.dbConfig?.url?.startsWith("postgres") && this.pgBinDir) {
      try {
        const result = embeddedDb.logicalBackup({
          databaseUrl: this.dbConfig.url,
          binDir: this.pgBinDir,
          backupsDir: this.dir.backups,
          keep: 30,
          log: this.log,
        });
        this.state.lastBackup = result;
        return result;
      } catch (e) {
        this.log("[vault] logical pg_dump unavailable (" + e.message + ") — falling back to physical copy");
      }
      const result = embeddedDb.physicalBackup({
        dataDir: this.dataDir,
        binDir: this.pgBinDir,
        backupsDir: this.dir.backups,
        keep: 30,
        log: this.log,
      });
      this.state.lastBackup = result;
      return result;
    }
    const result = await vault.createBackup({
      dataDir: this.dataDir,
      backupsDir: this.dir.backups,
      databaseUrl: this.databaseUrl(),
      keep: 30,
      log: this.log,
    });
    this.state.lastBackup = result;
    return result;
  }

  /**
   * Restore from a backup. Two paths:
   *   - PHYSICAL backup (a pgdata-* folder, what backupNow produces when pg_dump
   *     is not shipped): stop the server + Postgres, swap pgdata, restart both.
   *   - LOGICAL dump (.dump from pg_dump): stop the server so no connections
   *     hold the DB, run pg_restore (bundled bin first, PATH fallback), restart.
   * The server is ALWAYS restarted afterwards so the app comes back online.
   */
  async restoreFrom(dumpPath) {
    const binDir = this.pgBinDir || process.env.POSTGRES_BIN_DIR || undefined;
    const full = path.isAbsolute(dumpPath) ? dumpPath : path.join(this.dir.backups, dumpPath);
    const isPhysical = fs.existsSync(path.join(full, "PG_VERSION"));

    // 1. Take the server down so no connection blocks the restore.
    this.serverWatchdog?.stop();
    this.state.server = "stopped";
    this.log("[restore] server stopped");

    try {
      let result;
      if (isPhysical && this.dbConfig?.url?.startsWith("postgres") && binDir) {
        result = embeddedDb.physicalRestore({
          dataDir: this.dataDir,
          binDir,
          backupsDir: this.dir.backups,
          backupName: dumpPath,
          log: this.log,
        });
      } else {
        result = await vault.restoreBackup({
          backupsDir: this.dir.backups,
          dumpPath,
          dataDir: this.dataDir,
          databaseUrl: this.databaseUrl(),
          binDir,
          log: this.log,
        });
      }
      // 2. Bring the DB back (physical restore stops/restarts Postgres itself;
      //    logical restore leaves it running).
      if (!isPhysical) {
        const ok = await this.waitForDbReady(30_000);
        if (!ok) throw new Error("database did not become ready after restore");
        this.state.db = "running";
      }
      // 3. Restart the standalone server so the app is usable again.
      this.startServer();
      return result;
    } catch (e) {
      // Restore failed — try to bring the server back anyway.
      this.log("[restore] failed: " + e.message);
      this.startServer();
      throw e;
    }
  }

  exportToDrive(exportDir, { includeZips = false } = {}) {
    return vault.exportVault({
      backupsDir: this.dir.backups,
      exportDir,
      includeZips,
      log: this.log,
    });
  }

  // -------------------------------------------------------------------------
  // SCHEDULING
  // -------------------------------------------------------------------------
  scheduleDailyBackup(hour = 20, minute = 0) {
    const tick = () => {
      const now = new Date();
      if (now.getHours() === hour && now.getMinutes() === minute) {
        this.backupNow().catch((e) => this.log("[vault] auto-backup failed: " + e.message));
      }
    };
    this.backupTimer = setInterval(tick, 60_000);
    this.log(`[vault] daily auto-backup scheduled for ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  scheduleIdempotencyPrune(hour = 2, minute = 15) {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    let lastPruneDay = "";
    const tick = async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (now.getHours() === hour && now.getMinutes() === minute && lastPruneDay !== today) {
        lastPruneDay = today;
        try {
          const { pruneIdempotency } = require("./lib/pruneIdempotency");
          const deleted = await pruneIdempotency({ databaseUrl: this.databaseUrl(), days: 7, log: this.log });
          this.log(`[prune] idempotency keys pruned: ${deleted} (older than 7 days)`);
        } catch (e) {
          this.log("[prune] failed: " + (e && e.message));
        }
      }
    };
    this.pruneTimer = setInterval(tick, 60_000);
    // Avoid Node keeping the event loop alive solely for this timer in tests
    this.pruneTimer.unref?.();
    this.log(`[prune] daily idempotency prune scheduled for ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} (7-day TTL)`);
  }

  /**
   * Daily ledger integrity sweep (02:30 by default): asks the running app
   * server to scan for unbalanced entries + unposted documents via the
   * control-token endpoint, then logs the outcome. Runs happen through
   * ./lib/ledgerIntegrity so the timing guard is testable in isolation.
   */
  scheduleLedgerIntegrity(hour = 2, minute = 30) {
    const { scheduleLedgerIntegrity } = require("./lib/ledgerIntegrity");
    this.integritySweep = scheduleLedgerIntegrity({
      baseUrl: `http://127.0.0.1:${this.port}`,
      token: this.controlToken,
      hour,
      minute,
      log: this.log,
      isServerRunning: () => this.state.server === "running",
    });
  }

  notifyTray(message) {
    // Electron main calls tray.notify(message); plain-node mode logs it.
    this.log(`[tray] ${message}`);
  }

  health() {
    return {
      version: APP_VERSION,
      server: this.state.server,
      db: this.state.db,
      license: this.state.license?.status || "unknown",
      licenseOnline: this.state.licenseOnline || null,
      lastBackup: this.state.lastBackup,
      dataDir: this.dataDir,
      backupsDir: this.dir.backups,
    };
  }
}

// ---------------------------------------------------------------------------
// CLI MODE (headless testing on the build machine)
// ---------------------------------------------------------------------------
async function main(argv) {
  const args = argv.slice(2);
  // Only treat the token AFTER a flag as its value — without this, running a
  // bare action like `node launcher.js license` resolved the data dir to the
  // literal word "license" and created <cwd>/license/… (real pollution bug).
  const dataDir = argValue(args, "--data-dir");
  const port = Number(argValue(args, "--port") || 3000);
  const action = args.find((a) => ["start", "backup", "export", "license", "health"].includes(a)) || "start";

  const app = new DesktopApp({ dataDir, port, log: (m) => console.log(m) });

  if (action === "license") {
    app.ensureDirs();
    const r = app.evaluateLicense();
    console.log(JSON.stringify({ ...r, machineId: license.fingerprint() }, null, 2));
    return;
  }
  if (action === "backup") {
    app.ensureDirs();
    const r = await app.backupNow();
    console.log(JSON.stringify(r));
    return;
  }
  if (action === "export") {
    app.ensureDirs();
    const target = argValue(args, "--to");
    if (!target) throw new Error("--to <dir> required");
    console.log(JSON.stringify(app.exportToDrive(target)));
    return;
  }
  if (action === "health") {
    console.log(JSON.stringify(app.health(), null, 2));
    return;
  }

  // start
  app.ensureDirs();
  const lic = app.evaluateLicense();
  const licErr = licenseStartError(lic);
  if (licErr) {
    console.error("LICENSE_BLOCKED: " + licErr);
    process.exit(2);
  }
  app.ensureEmbeddedDb();
  app.startDb();
  if (app.state.db === "error") {
    console.error("DB_START_FAILED");
    process.exit(3);
  }
  if (!(await app.waitForDbReady())) {
    console.error("DB_NOT_READY");
    process.exit(3);
  }
  app.startDbWatchdog();
  app.applyInitialDataIfNeeded();
  if (!(app.dbConfig?.url || "").startsWith("postgres")) {
    // External/file DB flow (dev or non-embedded): apply migrations + seed as before.
    // Embedded Postgres is fully provisioned by schema.sql + seedbuild on first run.
    app.runMigrations();
    app.seedIfEmpty();
  }
  if (!app.startServer()) process.exit(4);
  await app.startControlServer();
  app.scheduleDailyBackup();
  app.scheduleIdempotencyPrune();
  app.scheduleLedgerIntegrity();
  app.silentUpdateCheck(); // fires and forgets — logs availability
  console.log(`[launcher] running — http://localhost:${port} (data: ${app.dataDir})`);
  console.log("Press Ctrl+C to stop.");
  let isStopping = false;
  const gracefulShutdown = (signal) => {
    if (isStopping) return;
    isStopping = true;
    try {
      app.stop();
    } catch (e) {
      console.error(`[launcher] error during ${signal} shutdown:`, e);
    }
    process.exit(0);
  };
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));
  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error("[launcher] fatal:", err.message);
    process.exit(1);
  });
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

/**
 * Decide whether boot may continue under the current activation state.
 * GRACE (no key yet within the first-run window, or a machine change within
 * its window) is deliberately non-blocking — offline-first plants keep
 * running while a key is arranged. EXPIRED (valid key, date passed) and
 * INVALID (no valid key and grace over) block startup.
 * @param {{status?: string, reason?: string, expiresAt?: string}} activation
 * @returns {string | null} blocking message, or null when boot may proceed
 */
function licenseStartError(activation) {
  if (!activation || typeof activation.status !== "string") {
    return "License state unknown — cannot start.";
  }
  if (activation.status === "ACTIVE" || activation.status === "GRACE") return null;
  if (activation.status === "EXPIRED") {
    const d = activation.expiresAt ? new Date(activation.expiresAt).toISOString() : "";
    return "This license expired" + (d ? " on " + d : "") + ". Contact your vendor to renew (MFGMAX_LICENSE).";
  }
  return "No valid license and the evaluation (grace) period has ended. Activate with a license key (MFGMAX_LICENSE).";
}

module.exports = { DesktopApp, argValue, resolveDataDir, resolveAppRoot, resolveResourcesDir, licenseStartError };
