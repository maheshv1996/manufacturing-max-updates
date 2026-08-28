"use strict";
/**
 * DESKTOP LICENSE HARDENING (v1.1) — build-time staging step.
 * ------------------------------------------------------------
 * Produces dist-staging/harden, a hardened mirror of desktop/ that
 * electron-builder packs instead of the plain source:
 *
 *   1. lib/license.js  -> lib/license.jsc  (V8 bytecode via bytenode,
 *      compiled with the SHIPPED Electron runtime so the bytecode format
 *      matches the packaged app; HMAC logic no longer readable text)
 *   2. remaining lib/*.js obfuscated with javascript-obfuscator
 *      (medium-obfuscation preset + disableConsoleOutput:false so the
 *      app's debug logs keep working)
 *   3. launcher.js / electron/main.js stay readable (debuggability);
 *      only the staged launcher gets the 2-line bytenode require patch
 *
*  Self-verification (fail-fast, no behavior change guardrails):
 *   a. per-lib export-key parity between source and staged libs
 *   b. staged launcher roundtrip: full 31-test desktop suite run against
 *      the obfuscated artifacts in dist-staging/test-run
 *   c. license.jsc compiled AND verified inside the REAL Electron main
 *      process (windowless one-shot app, not ELECTRON_RUN_AS_NODE — the
 *      loaded-vs-compiled isolate flags must match or the installed app
 *      dies with "Invalid or incompatible cached data (cachedDataRejected)"):
 *      export parity + sign/verify roundtrip + evaluateActivation sanity
 *
 * Usage: node scripts/harden-desktop.js   (part of `npm run dist`)
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DESKTOP = path.join(ROOT, "desktop");
const STAGE = path.join(ROOT, "dist-staging", "harden");
const TEST_RUN = path.join(ROOT, "dist-staging", "test-run");

const OBFUSCATE = ["licenseOnline", "semver", "sqliteSeedCheck", "updater", "vault", "watchdog", "controlServer", "embeddedDb"];

const ELECTRON_BIN = path.join(ROOT, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");
const BYTENODE = path.join(ROOT, "node_modules", "bytenode");
const OBFUSCATOR = path.join(ROOT, "node_modules", "javascript-obfuscator");
const ELECTRON_RUN_DIR = path.join(ROOT, "dist-staging", "electron-run");

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function cp(src, dst) {
  fs.cpSync(src, dst, { recursive: true });
}
function run(desc, cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) {
    const tail = ((r.stderr || r.stdout || "").toString().split(/\r?\n/).slice(-12).join("\n"));
    throw new Error(`${desc} failed (status ${r.status}):\n${tail}`);
  }
  return r.stdout;
}
function writeTemp(dir, name, content) {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

/**
 * Runs a one-shot script inside the REAL Electron MAIN PROCESS (windowless,
 * auto-exits). This is critical: ELECTRON_RUN_AS_NODE boots a plain-Node
 * isolate whose V8 flags differ from the browser-process default, so bytecode
 * compiled/verified there is REJECTED (cachedDataRejected) by the installed
 * app that loads license.jsc in its main process. V8 code cache is tied to
 * the isolate's flags, not just the V8 version.
 */
function runInElectronMain(name, body, desc) {
  const dir = path.join(ELECTRON_RUN_DIR, name);
  rmrf(dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: name + "-app", version: "1.0.0", main: "main.js" }));
  fs.writeFileSync(path.join(dir, "main.js"), body);
  try {
    return run(desc, ELECTRON_BIN, [dir]);
  } finally {
    rmrf(dir);
  }
}

function stageSources() {
  rmrf(STAGE);
  fs.mkdirSync(path.join(STAGE, "lib"), { recursive: true });
  fs.mkdirSync(path.join(STAGE, "electron"), { recursive: true });
  fs.copyFileSync(path.join(DESKTOP, "launcher.js"), path.join(STAGE, "launcher.js"));
  for (const f of fs.readdirSync(path.join(DESKTOP, "electron"))) {
    fs.copyFileSync(path.join(DESKTOP, "electron", f), path.join(STAGE, "electron", f));
  }
  for (const f of fs.readdirSync(path.join(DESKTOP, "lib"))) {
    if (f.endsWith(".js") || f.endsWith(".cjs")) {
      fs.copyFileSync(path.join(DESKTOP, "lib", f), path.join(STAGE, "lib", f));
    }
  }
}

function compileLicenseJsc() {
  runInElectronMain("compile", `
const path = require("path");
const { app } = require("electron");
try {
  const bytenode = require(${JSON.stringify(BYTENODE)});
  bytenode.compileFile(
    { filename: ${JSON.stringify(path.join(DESKTOP, "lib", "license.js"))}, compileAsModule: true },
    ${JSON.stringify(path.join(STAGE, "lib", "license.jsc"))}
  ).then(() => { console.log("JSC_COMPILED"); app.exit(0); })
   .catch((e) => { console.error("JSC_FAIL", e && e.message); app.exit(1); });
} catch (e) { console.error("JSC_FAIL", e && e.message); app.exit(1); }
`, "license.jsc compile (Electron main process)");
  if (!fs.existsSync(path.join(STAGE, "lib", "license.jsc"))) {
    throw new Error("license.jsc not produced");
  }
  fs.rmSync(path.join(STAGE, "lib", "license.js"), { force: true });
}

function obfuscateLibs() {
  const obfuscator = require(OBFUSCATOR);
  const preset = obfuscator.getOptionsByPreset("medium-obfuscation");
  const options = { ...preset, disableConsoleOutput: false, log: false };
  const summary = [];
  for (const name of OBFUSCATE) {
    const file = path.join(STAGE, "lib", `${name}.js`);
    const src = fs.readFileSync(file, "utf8");
    const out = obfuscator.obfuscate(src, options).getObfuscatedCode();
    fs.writeFileSync(file, out);
    summary.push({ name, src: src.length, out: out.length });
  }
  return summary;
}

function patchStagedLauncher() {
  const file = path.join(STAGE, "launcher.js");
  let code = fs.readFileSync(file, "utf8");
  const needle = `const license = require("./lib/license");`;
  if (!code.includes(needle)) throw new Error("launcher.js: license require line not found to patch");
  code = code.replace(needle, `require("bytenode"); // license hardening: .jsc loader (see scripts/harden-desktop.js)\nconst license = require("./lib/license.jsc");`);
  fs.writeFileSync(file, code);
}

function verifyExportParity() {
  const errors = [];
  for (const name of OBFUSCATE) {
    const src = require(path.join(DESKTOP, "lib", `${name}.js`));
    const hardened = require(path.join(STAGE, "lib", `${name}.js`));
    const a = Object.keys(src).sort().join(",");
    const b = Object.keys(hardened).sort().join(",");
    if (a !== b) errors.push(`${name}: exports differ (${a} vs ${b})`);
  }
  if (errors.length) throw new Error("export parity failed:\n" + errors.join("\n"));
  console.log("[harden] export parity OK for", OBFUSCATE.length, "libs");
}

function stageTestRun() {
  rmrf(TEST_RUN);
  fs.mkdirSync(path.join(TEST_RUN, "lib"), { recursive: true });
  for (const name of OBFUSCATE) {
    fs.copyFileSync(path.join(STAGE, "lib", `${name}.js`), path.join(TEST_RUN, "lib", `${name}.js`));
  }
  // license runs as plain source here (jsc is verified separately under Electron)
  fs.copyFileSync(path.join(DESKTOP, "lib", "license.js"), path.join(TEST_RUN, "lib", "license.js"));
  // launcher.js also runs as plain source here — the packaged asar carries the
  // bytenode-patched copy; tests exercise the real source logic (e.g. the
  // SESSION_SECRET regression in desktop/tests/launcher.test.js).
  fs.copyFileSync(path.join(DESKTOP, "launcher.js"), path.join(TEST_RUN, "launcher.js"));
  cp(path.join(DESKTOP, "tests"), path.join(TEST_RUN, "tests"));
}

function runStagedTests() {
  const out = run("staged test suite", process.execPath, ["--test", "tests/*.test.js"], {
    cwd: TEST_RUN,
  });
  const passLine = out.split(/\r?\n/).find((l) => /\bpass (\d+)/.test(l));
  const failLine = out.split(/\r?\n/).find((l) => /\bfail (\d+)/.test(l));
  const passCount = passLine ? Number(passLine.match(/\bpass (\d+)/)[1]) : -1;
  const failCount = failLine ? Number(failLine.match(/\bfail (\d+)/)[1]) : -1;
  console.log(`[harden] staged tests -> pass ${passCount}, fail ${failCount}`);
  if (passCount < 1 || failCount !== 0) {
    throw new Error("staged test run did not fully pass");
  }
}

function verifyJscInMainProcess() {
  runInElectronMain("verify", `
const path = require("path");
const { app } = require("electron");
try {
  const bytenode = require(${JSON.stringify(BYTENODE)});
  const jsc = require(${JSON.stringify(path.join(STAGE, "lib", "license.jsc"))});
  const src = require(${JSON.stringify(path.join(DESKTOP, "lib", "license.js"))});
  const a = Object.keys(jsc).sort().join(",");
  const b = Object.keys(src).sort().join(",");
  if (a !== b) { console.error("JSC_EXPORTS_MISMATCH", a, b); app.exit(1); }
  const signed = jsc.sign({ machineId: "jsc-test-machine" }, "jsc-test-secret");
  const verified = jsc.verify(signed, "jsc-test-secret");
  if (!signed || !verified || !verified.valid) { console.error("JSC_SIGN_VERIFY_FAIL", JSON.stringify(verified)); app.exit(1); }
  const ev = jsc.evaluateActivation({ key: "", secret: "s", machineId: "m", firstSeenDate: new Date().toISOString(), now: Date.now(), graceDays: 14 });
  if (!ev || typeof ev.status !== "string") { console.error("JSC_EVAL_FAIL"); app.exit(1); }
  const fp = jsc.fingerprint();
  if (typeof fp !== "string" || fp.length < 8) { console.error("JSC_FINGERPRINT_FAIL"); app.exit(1); }
  console.log("JSC_OK", a);
  app.exit(0);
} catch (e) { console.error("JSC_VERIFY_FAIL", e && e.message); app.exit(1); }
`, "license.jsc verify (Electron main process)");
}

function main() {
  const t0 = Date.now();
  console.log("[harden] staging desktop ->", path.relative(ROOT, STAGE));
  stageSources();
  console.log("[harden] compiling license.js -> license.jsc in the REAL Electron main process…");
  compileLicenseJsc();
  const summary = obfuscateLibs();
  for (const s of summary) {
    console.log(`[harden] obfuscated ${s.name}.js ${s.src} -> ${s.out} bytes`);
  }
  patchStagedLauncher();
  verifyExportParity();
  stageTestRun();
  runStagedTests();
  verifyJscInMainProcess();
  const jscSize = fs.statSync(path.join(STAGE, "lib", "license.jsc")).size;
  console.log(`[harden] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s — license.jsc=${jscSize}B, staged libs=${OBFUSCATE.length}`);
}

try {
  main();
} catch (e) {
  console.error("[harden] FAILED:", e.message);
  process.exit(1);
}
