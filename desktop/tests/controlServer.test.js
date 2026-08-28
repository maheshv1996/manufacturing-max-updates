"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { ControlServer } = require("../lib/controlServer");

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mfgmax-control-test-"));
}

function startFakeGitHub(dir, version) {
  const server = http.createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    if (req.url.startsWith("/repos/") && req.url.endsWith("/releases/latest")) {
      const exePath = path.join(dir, "installer.exe");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          tag_name: "v" + version,
          body: "test release notes",
          published_at: "2026-09-01T00:00:00Z",
          assets: [
            { name: `MfgMax-Setup-${version}.exe`, browser_download_url: `${base}/downloads/installer.exe`, size: fs.statSync(exePath).size },
            { name: `MfgMax-Setup-${version}.exe.sha256`, browser_download_url: `${base}/downloads/installer.exe.sha256`, size: 72 },
          ],
        })
      );
    } else if (req.url === "/downloads/installer.exe") {
      const data = fs.readFileSync(path.join(dir, "installer.exe"));
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": data.length });
      res.end(data);
    } else if (req.url === "/downloads/installer.exe.sha256") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(shaOf(path.join(dir, "installer.exe")) + "  MfgMax-Setup.exe\n");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function shaOf(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function call(port, token, method, p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: p, headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body || "{}") }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("control server: auth gate rejects bad token", async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "installer.exe"), "x");
  const feed = await startFakeGitHub(dir, "1.1.0");
  const cs = new ControlServer({ app: { stop() {} }, token: "sekret", repo: "acme/mfgmax-updates", apiBase: `http://127.0.0.1:${feed.address().port}`, controlPort: 0, log: () => {} });
  const port = await cs.start();
  try {
    const r = await call(port, "wrong", "GET", "/update/status");
    assert.strictEqual(r.status, 401);
  } finally {
    cs.stop();
    feed.close();
  }
});

test("control server: status reports updateAvailable with good token", async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "installer.exe"), "x");
  const feed = await startFakeGitHub(dir, "1.1.0");
  const cs = new ControlServer({ app: { stop() {} }, token: "sekret", repo: "acme/mfgmax-updates", apiBase: `http://127.0.0.1:${feed.address().port}`, controlPort: 0, log: () => {} });
  const port = await cs.start();
  try {
    const r = await call(port, "sekret", "GET", "/update/status");
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.feed.updateAvailable, true);
    assert.strictEqual(r.body.feed.latest, "1.1.0");
    assert.strictEqual(r.body.feed.tag, "v1.1.0");
  } finally {
    cs.stop();
    feed.close();
  }
});

test("control server: full apply cycle — download, verify, handoff, data preserved", async () => {
  const dir = tmpdir();
  const dataDir = path.join(dir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "app.db"), "precious-data");
  // Fake installer: node script touching a marker.
  const installerPath = path.join(dir, "installer.exe");
  fs.writeFileSync(installerPath, "require('fs').writeFileSync(process.env.UPDATE_MARKER, 'installed');\n");

  const feed = await startFakeGitHub(dir, "1.2.0");
  const marker = path.join(dir, "marker.txt");
  let stopped = false;
  let exitCode = null;

  const cs = new ControlServer({
    app: { stop() { stopped = true; } },
    token: "sekret",
    repo: "acme/mfgmax-updates",
    apiBase: `http://127.0.0.1:${feed.address().port}`,
    controlPort: 0,
    log: () => {},
    exitOverride: (code) => { exitCode = code; },
    spawnFn: (cmd, args, opts) => {
      const { spawn } = require("child_process");
      return spawn(process.execPath, [installerPath], { ...opts, env: { ...process.env, UPDATE_MARKER: marker } });
    },
  });
  cs.apply = cs.apply.bind(cs);
  const port = await cs.start();
  try {
    const start = await call(port, "sekret", "POST", "/update/apply");
    assert.strictEqual(start.body.started, true);

    // Poll progress until terminal phase.
    let state = null;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const p = await call(port, "sekret", "GET", "/update/progress");
      state = p.body;
      if (state.phase === "applying" || state.phase === "error") break;
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.strictEqual(state.phase, "applying", "should reach applying (got " + state.phase + " " + (state.error || "") + ")");
    assert.strictEqual(state.pct, 100);
    assert.strictEqual(stopped, true, "app.stop() called before handoff");
    await new Promise((r) => setTimeout(r, 1100)); // wait past applyUpdate's 800ms exit timer
    assert.strictEqual(exitCode, 0, "launcher exits 0 after handoff");
    assert.ok(fs.existsSync(marker), "installer executed");
    assert.ok(fs.existsSync(path.join(dataDir, "app.db")), "data dir preserved");
    assert.strictEqual(fs.readFileSync(path.join(dataDir, "app.db"), "utf8"), "precious-data");
  } finally {
    cs.stop();
    feed.close();
  }
});
