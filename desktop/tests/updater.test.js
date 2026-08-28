"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { checkGitHubRelease, fetchSha256Asset, downloadInstaller, applyUpdate } = require("../lib/updater");
const { compare, isNewer, parse } = require("../lib/semver");

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mfgmax-update-test-"));
}

function shaOf(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// ---------------------------------------------------------------------------
// SEMVER
// ---------------------------------------------------------------------------
test("semver compare basics", () => {
  assert.strictEqual(compare("1.1.0", "1.0.0"), 1);
  assert.strictEqual(compare("1.0.0", "1.0.0"), 0);
  assert.strictEqual(compare("0.9.9", "1.0.0"), -1);
  assert.strictEqual(compare("1.10.0", "1.9.9"), 1);
  assert.strictEqual(compare("v1.2.3", "1.2.3"), 0);
  assert.strictEqual(compare("1.0.0-alpha", "1.0.0"), -1);
  assert.ok(Number.isNaN(compare("banana", "1.0.0")));
});

test("semver isNewer", () => {
  assert.strictEqual(isNewer("1.1.0", "1.0.0"), true);
  assert.strictEqual(isNewer("1.0.0", "1.1.0"), false);
  assert.strictEqual(isNewer("1.0.0", "1.0.0"), false);
});

test("parse rejects garbage", () => {
  assert.strictEqual(parse("nope"), null);
});

// ---------------------------------------------------------------------------
// GITHUB-DIRECT FEED
// ---------------------------------------------------------------------------
// Serves a GitHub-API-shaped release: /repos/<owner>/<repo>/releases/latest
// with the .exe + .sha256 release assets, plus the download endpoints.
function serveGitHub(dir, version) {
  const server = http.createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    if (req.url.startsWith("/repos/") && req.url.endsWith("/releases/latest")) {
      const exePath = path.join(dir, "installer.exe");
      const sha = fs.existsSync(exePath) ? shaOf(exePath) : "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          tag_name: "v" + version,
          name: "v" + version,
          body: "release notes for " + version,
          published_at: "2026-09-01T00:00:00Z",
          assets: [
            { name: `MfgMax-Setup-${version}.exe`, browser_download_url: `${base}/downloads/installer.exe`, size: fs.existsSync(exePath) ? fs.statSync(exePath).size : 0 },
            { name: `MfgMax-Setup-${version}.exe.sha256`, browser_download_url: `${base}/downloads/installer.exe.sha256`, size: 72 },
          ],
        })
      );
    } else if (req.url === "/downloads/installer.exe") {
      // GitHub 302s asset downloads to its CDN — mirror that.
      res.writeHead(302, { Location: `${base}/real/installer.exe` });
      res.end();
    } else if (req.url === "/downloads/installer.exe.sha256") {
      res.writeHead(302, { Location: `${base}/real/installer.exe.sha256` });
      res.end();
    } else if (req.url === "/loop/installer.exe.sha256") {
      res.writeHead(302, { Location: `${base}/loop/installer.exe.sha256` });
      res.end();
    } else if (req.url === "/real/installer.exe") {
      const data = fs.readFileSync(path.join(dir, "installer.exe"));
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": data.length });
      res.end(data);
    } else if (req.url === "/real/installer.exe.sha256") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(shaOf(path.join(dir, "installer.exe")) + "  MfgMax-Setup.exe\n");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("checkGitHubRelease reports a newer tagged release with metadata", async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "installer.exe"), "fake-installer");
  const server = await serveGitHub(dir, "1.2.0");
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await checkGitHubRelease({ repo: "acme/mfgmax-updates", apiBase, currentVersion: "1.1.0" });
    assert.strictEqual(r.offline, false);
    assert.strictEqual(r.updateAvailable, true);
    assert.strictEqual(r.latest, "1.2.0");
    assert.strictEqual(r.tag, "v1.2.0");
    assert.ok(r.notes.includes("release notes"));
    assert.ok(r.url.endsWith("/downloads/installer.exe"));
    assert.ok(r.sha256Url.endsWith(".sha256"));
  } finally {
    server.close();
  }
});

test("checkGitHubRelease: no update when same version", async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "installer.exe"), "fake-installer");
  const server = await serveGitHub(dir, "1.1.0");
  try {
    const r = await checkGitHubRelease({ repo: "acme/mfgmax-updates", apiBase: `http://127.0.0.1:${server.address().port}`, currentVersion: "1.1.0" });
    assert.strictEqual(r.updateAvailable, false);
  } finally {
    server.close();
  }
});

test("checkGitHubRelease: offline when repo not configured", async () => {
  const r = await checkGitHubRelease({ repo: "", currentVersion: "1.0.0" });
  assert.strictEqual(r.offline, true);
});

test("checkGitHubRelease: offline on unreachable API (rate limit / no network)", async () => {
  const r = await checkGitHubRelease({ repo: "a/b", apiBase: "http://127.0.0.1:1", currentVersion: "1.0.0", timeoutMs: 1500 });
  assert.strictEqual(r.offline, true);
});

test("fetchSha256Asset extracts the 64-hex digest with or without filename", async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "installer.exe"), "fake-installer");
  const server = await serveGitHub(dir, "1.2.0");
  try {
    const sha = await fetchSha256Asset(`http://127.0.0.1:${server.address().port}/downloads/installer.exe.sha256`);
    assert.match(sha, /^[0-9a-f]{64}$/);
    assert.strictEqual(sha, shaOf(path.join(dir, "installer.exe")));
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// DOWNLOAD + CHECKSUM
// ---------------------------------------------------------------------------
test("downloadInstaller verifies a matching sha256 and reports progress", async () => {
  const dir = tmpdir();
  const content = crypto.randomBytes(1024 * 128);
  fs.writeFileSync(path.join(dir, "installer.exe"), content);
  const sha = shaOf(path.join(dir, "installer.exe"));

  const server = await serveGitHub(dir, "1.2.0");
  const destDir = path.join(dir, "downloads");
  const progress = [];
  try {
    const file = await downloadInstaller({
      url: `http://127.0.0.1:${server.address().port}/downloads/installer.exe`,
      sha256: sha,
      destDir,
      onProgress: (p) => progress.push(p),
    });
    assert.ok(fs.existsSync(file));
    assert.strictEqual(fs.readFileSync(file).length, content.length);
    assert.ok(progress.length > 0, "progress callback fired");
    assert.strictEqual(progress[progress.length - 1].pct, 100);
  } finally {
    server.close();
  }
});

test("downloadInstaller ABORTS on checksum mismatch and deletes the file", async () => {
  const dir = tmpdir();
  const content = crypto.randomBytes(64 * 1024);
  fs.writeFileSync(path.join(dir, "installer.exe"), content);

  const server = await serveGitHub(dir, "1.2.0");
  const destDir = path.join(dir, "downloads");
  try {
    await assert.rejects(
      () => downloadInstaller({ url: `http://127.0.0.1:${server.address().port}/downloads/installer.exe`, sha256: "f".repeat(64), destDir }),
      (err) => err.code === "CHECKSUM_MISMATCH"
    );
    assert.strictEqual(fs.readdirSync(destDir).length, 0, "bad binary must be deleted");
  } finally {
    server.close();
  }
});

test("fetchSha256Asset follows redirects and bounds redirect loops", async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "installer.exe"), "fake-installer");
  const server = await serveGitHub(dir, "1.2.0");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // 302 -> real asset: resolved through the redirect chain.
    const sha = await fetchSha256Asset(`${base}/downloads/installer.exe.sha256`);
    assert.strictEqual(sha, shaOf(path.join(dir, "installer.exe")));
    // Redirect loop: bounded hops, error surfaced, no hang.
    await assert.rejects(() => fetchSha256Asset(`${base}/loop/installer.exe.sha256`), (err) => err.message === "SHA_TOO_MANY_REDIRECTS");
  } finally {
    server.close();
  }
});

test("downloadInstaller follows redirects (GitHub CDN handoff)", async () => {
  const dir = tmpdir();
  const content = crypto.randomBytes(64 * 1024);
  fs.writeFileSync(path.join(dir, "installer.exe"), content);
  const server = await serveGitHub(dir, "1.2.0");
  const destDir = path.join(dir, "downloads");
  try {
    const file = await downloadInstaller({
      url: `http://127.0.0.1:${server.address().port}/downloads/installer.exe`, // 302s first
      sha256: shaOf(path.join(dir, "installer.exe")),
      destDir,
    });
    assert.strictEqual(fs.readFileSync(file).length, content.length);
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// INSTALLER HANDOFF + DATA PRESERVATION
// ---------------------------------------------------------------------------
test("applyUpdate stops children, launches installer, preserves data dir", async () => {
  const dir = tmpdir();
  const dataDir = path.join(dir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "app.db"), "precious-data");

  let stopped = false;
  let spawnedCmd = null;
  const installerPath = path.join(dir, "installer.exe");
  fs.writeFileSync(installerPath, "require('fs').writeFileSync(process.env.UPDATE_MARKER, 'installed');\n");

  const fakeSpawn = (cmd, args, opts) => {
    spawnedCmd = cmd;
    const { spawn: realSpawn } = require("child_process");
    return realSpawn(process.execPath, [installerPath], { ...opts, env: { ...process.env, UPDATE_MARKER: path.join(dir, "marker.txt") } });
  };

  applyUpdate({
    installerPath,
    stop: () => { stopped = true; },
    log: () => {},
    exit: () => {},
    spawnFn: fakeSpawn,
  });
  assert.strictEqual(stopped, true, "stop() must be called before handoff");
  assert.strictEqual(spawnedCmd, installerPath, "installer path handed to spawn");
  await new Promise((r) => setTimeout(r, 600));
  assert.ok(fs.existsSync(path.join(dir, "marker.txt")), "installer ran");
  assert.ok(fs.existsSync(path.join(dataDir, "app.db")), "data dir untouched");
  assert.strictEqual(fs.readFileSync(path.join(dataDir, "app.db"), "utf8"), "precious-data");
});
