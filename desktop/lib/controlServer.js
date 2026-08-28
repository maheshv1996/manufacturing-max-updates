"use strict";
/**
 * LAUNCHER CONTROL SERVER (update channel plumbing)
 * -------------------------------------------------
 * A tiny HTTP server bound to 127.0.0.1 ONLY, gated by a bearer token
 * (MFGMAX_CONTROL_TOKEN). The Next server proxies to it (the browser never
 * sees the token). Endpoints:
 *
 *   GET  /update/status   -> { currentVersion, feed: <checkForUpdate result> }
 *   GET  /update/progress -> { phase, pct, received, total, error? }
 *   POST /update/apply    -> starts streamed download -> checksum verify ->
 *                            graceful stop -> installer handoff -> exit(0)
 *   POST /shutdown        -> graceful stop + exit (tray Quit / before update)
 *
 * Phases: idle | downloading | verifying | applying | error
 */
const http = require("http");
const path = require("path");
const os = require("os");
const { checkGitHubRelease, fetchSha256Asset, downloadInstaller, applyUpdate } = require("./updater");

class ControlServer {
  constructor({ app, token, repo, apiBase = "https://api.github.com", controlPort = 41841, version = null, log = console.log, exitOverride = null, spawnFn = null }) {
    this.app = app; // DesktopApp instance (stop/startServer/health)
    this.token = token;
    this.repo = repo;
    this.apiBase = apiBase;
    this.controlPort = controlPort;
    // The launcher resolves the version from package.json (single source);
    // fall back to package.json here so a caller that forgets never drifts.
    this.version = version || (() => { try { return require("../../package.json").version; } catch { return "1.0.0"; } })();
    this.log = log;
    this.exitOverride = exitOverride; // test hook — replaces process.exit on handoff
    this.spawnFn = spawnFn; // test hook — replaces the installer spawn
    this.state = { phase: "idle", pct: 0, received: 0, total: 0, error: null, applied: false };
    this.server = null;
  }

  auth(req, res) {
    const h = req.headers["authorization"] || "";
    const ok = this.token && h === `Bearer ${this.token}`;
    if (!ok) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "UNAUTHORIZED" }));
      return false;
    }
    return true;
  }

  async handleStatus() {
    const feed = await checkGitHubRelease({ repo: this.repo, apiBase: this.apiBase, currentVersion: this.version });
    return { currentVersion: this.version, feed };
  }

  apply() {
    if (this.state.phase === "downloading" || this.state.phase === "applying") {
      return { error: "UPDATE_IN_PROGRESS" };
    }
    this.state = { phase: "downloading", pct: 0, received: 0, total: 0, error: null, applied: false };

    (async () => {
      try {
        const feed = await checkGitHubRelease({ repo: this.repo, apiBase: this.apiBase, currentVersion: this.version });
        if (feed.offline || !feed.updateAvailable || !feed.url) {
          throw Object.assign(new Error(feed.offline ? "OFFLINE" : "NO_UPDATE"), { code: feed.offline ? "OFFLINE" : "NO_UPDATE" });
        }
        // Security: the installer only runs after the matching .sha256 asset
        // is fetched from the release and verified against the download.
        if (!feed.sha256Url) {
          throw Object.assign(new Error("NO_SHA_ASSET"), { code: "NO_SHA_ASSET" });
        }
        const sha256 = await fetchSha256Asset(feed.sha256Url);
        const destDir = path.join(os.tmpdir(), "mfgmax-updates");
        this.state.phase = "downloading";
        const installerPath = await downloadInstaller({
          url: feed.url,
          sha256,
          destDir,
          onProgress: (p) => {
            this.state.received = p.received;
            this.state.total = p.total;
            this.state.pct = p.pct ?? 0;
          },
        });
        this.state.phase = "verifying";
        this.state.pct = 100;
        this.state.phase = "applying";
        applyUpdate({
          installerPath,
          stop: () => this.app.stop(),
          log: this.log,
          exit: this.exitOverride || ((code) => {
            this.state.applied = true;
            process.exit(code);
          }),
          spawnFn: this.spawnFn || undefined,
        });
      } catch (err) {
        this.state.phase = "error";
        this.state.error = err.code || err.message || String(err);
        this.log("[control] update failed: " + this.state.error);
      }
    })();

    return { started: true };
  }

  shutdown() {
    this.app.stop();
    this.state.phase = "idle";
    return { shuttingDown: true };
  }

  start() {
    this.server = http.createServer(async (req, res) => {
      const send = (obj, code = 200) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (!this.auth(req, res)) return;
      try {
        const u = new URL(req.url, "http://127.0.0.1");
        if (req.method === "GET" && u.pathname === "/update/status") return send(await this.handleStatus());
        if (req.method === "GET" && u.pathname === "/update/progress") return send(this.state);
        if (req.method === "POST" && u.pathname === "/update/apply") return send(this.apply());
        if (req.method === "POST" && u.pathname === "/shutdown") return send(this.shutdown());
        return send({ error: "NOT_FOUND" }, 404);
      } catch (err) {
        return send({ error: err.message || String(err) }, 500);
      }
    });
    return new Promise((resolve) => {
      this.server.listen(this.controlPort, "127.0.0.1", () => {
        const actual = this.server.address().port;
        this.controlPort = actual;
        this.log(`[control] update control server on 127.0.0.1:${actual}`);
        resolve(actual);
      });
    });
  }

  stop() {
    this.server?.close();
  }
}

module.exports = { ControlServer };
