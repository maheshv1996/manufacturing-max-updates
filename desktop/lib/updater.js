"use strict";
/**
 * ONLINE UPDATE CHANNEL (Phase 4 / update flow)
 * ---------------------------------------------
 *  - checkGitHubRelease: fetch the latest GitHub Release (5s timeout,
 *    unauthenticated — 60 req/hr is plenty for start-check + manual). On any
 *    failure return { offline: true } so the caller can suggest
 *    "Update from File" (pendrive flow for air-gapped sites). The .exe
 *    asset URL + size come from the release; the matching `.sha256` release
 *    asset is fetched separately before install.
 *  - downloadInstaller: stream the installer to a temp file with progress
 *    callbacks, hashing as it streams. Verify sha256 at the end:
 *      PASS -> return the temp path
 *      FAIL -> delete the temp file, throw CHECKSUM_MISMATCH (caller shows
 *              a red security alert, NEVER runs the file)
 *  - applyUpdate: stop the server + DB, launch the installer, then quit
 *    the launcher. The installer preserves the data dir and re-runs
 *    `prisma migrate deploy` (see docs/RELEASE_CHECKLIST.md).
 *
 * Pure Node (crypto, http/https, fs) — unit-testable offline.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const { isNewer } = require("./semver");

function fetchJson(url, { headers = {}, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const attempt = (target, hops) => {
      let mod = http;
      try {
        const u = new URL(target);
        mod = u.protocol === "https:" ? https : http;
      } catch {
        return reject(new Error("BAD_URL"));
      }
      const req = mod.get(target, { timeout: timeoutMs, headers: { "User-Agent": "MfgMax-Desktop-Updater", Accept: "application/json", ...headers } }, (res) => {
        // GitHub 302s asset downloads to its CDN — follow redirects, bounded.
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (hops <= 0) return reject(new Error("FEED_TOO_MANY_REDIRECTS"));
          return attempt(new URL(res.headers.location, target).toString(), hops - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("FEED_HTTP_" + res.statusCode));
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("FEED_BAD_JSON"));
          }
        });
      });
      req.on("timeout", () => req.destroy(new Error("FEED_TIMEOUT")));
      req.on("error", (e) => reject(e));
    };
    attempt(url, 5);
  });
}

function fetchText(url, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const attempt = (target, hops) => {
      let mod = http;
      try {
        const u = new URL(target);
        mod = u.protocol === "https:" ? https : http;
      } catch {
        return reject(new Error("BAD_URL"));
      }
      const req = mod.get(target, { timeout: timeoutMs, headers: { "User-Agent": "MfgMax-Desktop-Updater" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (hops <= 0) return reject(new Error("SHA_TOO_MANY_REDIRECTS"));
          return attempt(new URL(res.headers.location, target).toString(), hops - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("SHA_HTTP_" + res.statusCode));
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(body.trim()));
      });
      req.on("timeout", () => req.destroy(new Error("SHA_TIMEOUT")));
      req.on("error", (e) => reject(e));
    };
    attempt(url, 5);
  });
}

/**
 * GITHUB DIRECT update check (zero Vercel).
 * GET <apiBase>/repos/<repo>/releases/latest, compare tag_name (semver)
 * against the installed version. The .exe asset URL + size come from the
 * release assets; the matching `.sha256` asset is fetched separately by
 * fetchSha256Asset before install.
 *
 * @param {{ repo: string, currentVersion: string, apiBase?: string, timeoutMs?: number }}
 * @returns {Promise<{ offline: boolean } | { offline: false, current, latest, updateAvailable, version, notes, url, sha256Url, sha256, sizeMb, tag, releasedAt }>}
 */
async function checkGitHubRelease({ repo, currentVersion, apiBase = "https://api.github.com", timeoutMs = 5000 }) {
  if (!repo || !repo.includes("/")) return { offline: true, reason: "no GITHUB_UPDATE_REPO configured" };
  const url = `${apiBase}/repos/${repo}/releases/latest`;
  let feed;
  try {
    feed = await fetchJson(url, { timeoutMs, headers: { Accept: "application/vnd.github+json" } });
  } catch {
    return { offline: true, reason: "github unreachable or rate-limited" };
  }
  const tag = String(feed.tag_name || "");
  const latest = tag.replace(/^v/, "");
  const assets = Array.isArray(feed.assets) ? feed.assets : [];
  const exe = assets.find((a) => /\.exe$/i.test(a.name) && !/\.sha256$/i.test(a.name));
  const shaAsset = assets.find((a) => /\.sha256$/i.test(a.name));
  const updateAvailable = isNewer(latest, currentVersion);
  return {
    offline: false,
    current: currentVersion,
    latest,
    updateAvailable,
    version: latest,
    notes: feed.body || "",
    url: exe?.browser_download_url || "",
    sha256Url: shaAsset?.browser_download_url || null,
    sha256: null, // fetched from the .sha256 asset before install
    sizeMb: exe?.size ? Math.round((exe.size / 1024 / 1024) * 10) / 10 : 0,
    tag,
    releasedAt: feed.published_at || null,
  };
}

/** Fetch the .sha256 asset and extract the 64-hex digest (first token). */
async function fetchSha256Asset(sha256Url, { timeoutMs = 5000 } = {}) {
  const text = await fetchText(sha256Url, { timeoutMs });
  const m = text.match(/\b[0-9a-fA-F]{64}\b/);
  if (!m) throw new Error("SHA_BAD_FORMAT");
  return m[0].toLowerCase();
}

/** Backwards-compatible alias: GITHUB direct is now the only feed. */
async function checkForUpdate({ repo, currentVersion, apiBase, timeoutMs }) {
  return checkGitHubRelease({ repo, currentVersion, apiBase, timeoutMs });
}

/**
 * Stream-download the installer, hashing while streaming. Returns the temp
 * file path on success; throws CHECKSUM_MISMATCH (after deleting the file)
 * on mismatch, or propagates network errors.
 */
function downloadInstaller({ url, sha256, destDir, onProgress = () => {} }) {
  return new Promise((resolve, reject) => {
    let dest = null;
    const attempt = (target, hops) => {
      let mod = http;
      try {
        const u = new URL(target);
        mod = u.protocol === "https:" ? https : http;
      } catch {
        return reject(new Error("BAD_INSTALLER_URL"));
      }
      const req = mod.get(target, { timeout: 60_000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (hops <= 0) return reject(new Error("DOWNLOAD_TOO_MANY_REDIRECTS"));
          return attempt(new URL(res.headers.location, target).toString(), hops - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("DOWNLOAD_HTTP_" + res.statusCode));
        }
        fs.mkdirSync(destDir, { recursive: true });
        dest = path.join(destDir, `mfgmax-update-${Date.now()}.exe`);
        const hash = crypto.createHash("sha256");
        let received = 0;
        let total = 0;

        total = Number(res.headers["content-length"]) || 0;
        const out = fs.createWriteStream(dest);
        res.on("data", (chunk) => {
          received += chunk.length;
          hash.update(chunk);
          onProgress({ received, total: total || received, pct: total ? (received / total) * 100 : null });
        });
        res.pipe(out);
        out.on("finish", () => {
          out.close(() => {
            const digest = hash.digest("hex");
            const expected = String(sha256 || "").toLowerCase();
            if (expected && digest !== expected) {
              fs.unlinkSync(dest); // never leave a bad binary around
              return reject(Object.assign(new Error("CHECKSUM_MISMATCH"), { code: "CHECKSUM_MISMATCH", actual: digest, expected }));
            }
            resolve(dest);
          });
        });
        out.on("error", (e) => {
          if (dest) { try { fs.unlinkSync(dest); } catch {} }
          reject(e);
        });
      });
      req.on("timeout", () => req.destroy(new Error("DOWNLOAD_TIMEOUT")));
      req.on("error", (e) => {
        if (dest) { try { fs.unlinkSync(dest); } catch {} }
        reject(e);
      });
    };
    attempt(url, 5);
  });
}

/**
 * Graceful handoff: stop server + DB, spawn the installer detached, exit.
 * @param {{ installerPath: string, stop: () => void, dataDir: string, log: (s: string) => void }}
 */
function applyUpdate({ installerPath, stop, log = () => {}, exit = (code) => process.exit(code), spawnFn = spawn }) {
  if (!fs.existsSync(installerPath)) throw new Error("INSTALLER_MISSING");
  stop(); // stops server + DB watchdogs; data dir is never touched here
  log(`[update] launching installer: ${installerPath}`);
  const child = spawnFn(installerPath, [], { detached: true, stdio: "ignore" });
  child.unref();
  // Give the installer a beat to take over, then exit the launcher.
  setTimeout(() => exit(0), 800);
  return child;
}

module.exports = { checkForUpdate, checkGitHubRelease, fetchSha256Asset, downloadInstaller, applyUpdate, fetchJson, fetchText };
