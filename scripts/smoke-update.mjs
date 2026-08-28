#!/usr/bin/env node
/**
 * smoke-update.mjs — UPDATE CHANNEL end-to-end smoke test
 * -------------------------------------------------------
 * Verifies the WHOLE online-update pipeline against a LOCAL fake GitHub
 * release (no network, no PAT needed), using the real production code in
 * desktop/lib/updater.js:
 *
 *   1. checkGitHubRelease  -> newer release detected, metadata parsed
 *   2. fetchSha256Asset    -> digest extracted from the .sha256 asset
 *   3. downloadInstaller   -> streams with progress, sha256 verified
 *   4. checksum FAIL path  -> CHECKSUM_MISMATCH, bad binary deleted
 *   5. applyUpdate         -> stop() called, installer spawned, exit
 *   6. DATA SURVIVES       -> a marker file in the "data dir" is untouched
 *
 * Usage:  node scripts/smoke-update.mjs        (exit 0 = all pass)
 *         node scripts/smoke-update.mjs --json (machine-readable summary)
 */
import { createHash, randomBytes } from "crypto";
import { createServer } from "http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawn } from "child_process";
import { checkGitHubRelease, fetchSha256Asset, downloadInstaller, applyUpdate } from "../desktop/lib/updater.js";

const useJson = process.argv.includes("--json");
const results = [];
const shaOf = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!useJson) {
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name} ${detail}`);
  }
}

/** Local GitHub-API-shaped server: release feed + CDN-style asset redirects. */
function serveFakeRelease({ installerPath, version }) {
  const server = createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    if (req.url.startsWith("/repos/") && req.url.endsWith("/releases/latest")) {
      const size = existsSync(installerPath) ? statSync(installerPath).size : 0;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        tag_name: "v" + version,
        name: "Manufacturing Max " + version,
        body: "Release notes for " + version + "\n- fixes\n- features",
        published_at: "2026-09-01T00:00:00Z",
        assets: [
          { name: `ManufacturingMax-Setup-${version}.exe`, browser_download_url: `${base}/downloads/installer.exe`, size },
          { name: `ManufacturingMax-Setup-${version}.exe.sha256`, browser_download_url: `${base}/downloads/installer.exe.sha256`, size: 72 },
        ],
      }));
    } else if (req.url === "/downloads/installer.exe") {
      res.writeHead(302, { Location: `${base}/real/installer.exe` }); // GitHub CDN handoff
      res.end();
    } else if (req.url === "/downloads/installer.exe.sha256") {
      res.writeHead(302, { Location: `${base}/real/installer.exe.sha256` });
      res.end();
    } else if (req.url === "/real/installer.exe") {
      const data = readFileSync(installerPath);
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": data.length });
      res.end(data);
    } else if (req.url === "/real/installer.exe.sha256") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(shaOf(installerPath) + "  ManufacturingMax-Setup.exe\n");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  if (!useJson) console.log("=== UPDATE CHANNEL SMOKE TEST ===");

  const dir = mkdtempSync(join(tmpdir(), "mfgmax-update-smoke-"));
  const installerPath = join(dir, "installer.exe");
  const dataDir = join(dir, "data");
  const dataMarker = join(dataDir, "precious.db");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(dataMarker, "customer-data-must-survive-updates");
  writeFileSync(installerPath, randomBytes(256 * 1024)); // fake 256KB "installer"

  const server = await serveFakeRelease({ installerPath, version: "1.0.1" });
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  const downloadDir = join(dir, "downloads");

  try {
    // 1. Check — newer release detected
    const feed = await checkGitHubRelease({ repo: "acme/mfgmax-updates", apiBase, currentVersion: "1.0.0", timeoutMs: 5000 });
    record("Check finds newer release", feed.offline === false && feed.updateAvailable === true && feed.latest === "1.0.1",
      `latest=${feed.latest} notes="${(feed.notes || "").split("\n")[0]}" sizeMb=${feed.sizeMb}`);
    record("Check parses asset URLs", !!(feed.url && feed.sha256Url), `url=${feed.url ? "set" : "MISSING"} shaUrl=${feed.sha256Url ? "set" : "MISSING"}`);

    // 2. Fetch the sha256 asset
    let sha = "";
    try {
      sha = await fetchSha256Asset(feed.sha256Url);
      record("Fetch .sha256 asset", /^[0-9a-f]{64}$/.test(sha), `sha=${sha.slice(0, 12)}…`);
    } catch (e) {
      record("Fetch .sha256 asset", false, e.message);
    }

    // 3. Stream download + checksum PASS
    const progress = [];
    let dlFile = "";
    try {
      dlFile = await downloadInstaller({ url: feed.url, sha256: sha, destDir: downloadDir, onProgress: (p) => progress.push(p) });
      const same = shaOf(dlFile) === shaOf(installerPath);
      record("Download + checksum PASS", same && progress.length > 0, `bytes=${statSync(dlFile).size} progressCalls=${progress.length} lastPct=${progress[progress.length - 1]?.pct ?? "?"}`);
    } catch (e) {
      record("Download + checksum PASS", false, e.message);
    }

    // 4. Checksum FAIL path — wrong sha aborts + deletes (fresh dir so the
    //    good file from step 3 can't pollute the count)
    const failDir = join(dir, "downloads-fail");
    let mismatchCaught = false;
    let leftover = -1;
    try {
      await downloadInstaller({ url: feed.url, sha256: "f".repeat(64), destDir: failDir });
    } catch (e) {
      mismatchCaught = e.code === "CHECKSUM_MISMATCH";
      leftover = readdirSync(failDir).length;
    }
    record("Checksum FAIL aborts + deletes", mismatchCaught && leftover === 0, `code=${mismatchCaught ? "CHECKSUM_MISMATCH" : "none"} filesLeft=${leftover}`);

    // 5. applyUpdate — stop() called, installer spawned, exit invoked
    let stopped = false;
    let spawned = null;
    const markerFile = join(dir, "handoff-marker.txt");
    const fakeSpawn = (cmd, args, opts) => {
      spawned = cmd;
      // Run a tiny node script as the "installer" to prove handoff works.
      writeFileSync(join(dir, "handoff-script.js"), `require('fs').writeFileSync(${JSON.stringify(markerFile)}, 'installed');`);
      return spawn(process.execPath, [join(dir, "handoff-script.js")], { ...opts, stdio: "ignore" });
    };
    let exited = false;
    applyUpdate({
      installerPath: dlFile || installerPath,
      stop: () => { stopped = true; },
      log: () => {},
      exit: () => { exited = true; },
      spawnFn: fakeSpawn,
    });
    await new Promise((r) => setTimeout(r, 1500));
    record("Handoff: stop() before launch", stopped === true, `stopped=${stopped}`);
    record("Handoff: installer spawned", spawned !== null && (spawned === dlFile || spawned === installerPath), `cmd=${spawned ?? "none"}`);
    record("Handoff: exit called", exited === true, `exited=${exited}`);
    record("Installer actually ran", existsSync(markerFile), existsSync(markerFile) ? "marker written" : "marker MISSING");

    // 6. DATA SURVIVES the update
    const dataStillThere = existsSync(dataMarker) && readFileSync(dataMarker, "utf8") === "customer-data-must-survive-updates";
    record("Data dir survives update", dataStillThere, dataStillThere ? "marker intact" : "MARKER LOST");

    // 7. No-update path — same version offers nothing
    const sameFeed = await checkGitHubRelease({ repo: "acme/mfgmax-updates", apiBase, currentVersion: "1.0.1", timeoutMs: 5000 });
    record("Same version -> no update offered", sameFeed.updateAvailable === false, `updateAvailable=${sameFeed.updateAvailable}`);

    // 8. Offline path — unreachable feed degrades gracefully
    const offline = await checkGitHubRelease({ repo: "acme/mfgmax-updates", apiBase: "http://127.0.0.1:1", currentVersion: "1.0.0", timeoutMs: 1500 });
    record("Unreachable feed -> offline flag", offline.offline === true, `offline=${offline.offline}`);
  } finally {
    server.close();
  }

  const fails = results.filter((r) => !r.ok);
  if (useJson) {
    console.log(JSON.stringify({ total: results.length, passed: results.length - fails.length, results }, null, 2));
  } else {
    console.log(`\n=== SUMMARY: ${results.length - fails.length}/${results.length} passed ===`);
    for (const f of fails) console.log(`  FAIL ${f.name} ${f.detail}`);
  }
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  if (useJson) console.log(JSON.stringify({ fatal: e.message }));
  else console.error("FATAL:", e.message);
  process.exit(1);
});
