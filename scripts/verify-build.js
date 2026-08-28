#!/usr/bin/env node
/**
 * verify-build — pre-start guard (run by `npm start` and the desktop launcher
 * before spawning the server).
 *
 * Fails fast if the build on disk is inconsistent: every /_next/static asset
 * referenced by the built pages must exist. This is exactly the failure that
 * made the app render unstyled when a server outlived a rebuild — a stale
 * manifest referencing deleted CSS hashes (500 on the stylesheet).
 *
 * Usage: node scripts/verify-build.js   (exit 0 = safe to start, 1 = rebuild needed)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");

if (!fs.existsSync(path.join(nextDir, "BUILD_ID"))) {
  console.error("[verify-build] ✗ .next/BUILD_ID not found — run `npm run build` first.");
  process.exit(1);
}

// Collect every built HTML page under .next/server/app
const htmlFiles = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".html")) htmlFiles.push(p);
  }
})(path.join(nextDir, "server", "app"));

const missing = new Set();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const refs = html.match(/\/_next\/static\/[^"')\s]+/g) || [];
  for (const ref of refs) {
    // Normalize: strip escaped-quote artifacts (e.g. `js\\` from inline JS) and
    // only consider real asset references (js/css/fonts/images).
    const clean = ref.replace(/[\\?].*$/, "");
    if (!/\.(js|css|woff2?|ttf|png|svg|jpe?g|gif|webp|ico)$/.test(clean)) continue;
    const onDisk = path.join(nextDir, clean.replace(/^\/_next\/static\//, "static/"));
    if (!fs.existsSync(onDisk)) missing.add(clean);
  }
}

if (missing.size > 0) {
  console.error(
    `[verify-build] ✗ ${missing.size} asset(s) referenced by the build are MISSING on disk:`
  );
  for (const m of missing) console.error(`   ${m}`);
  console.error(
    "[verify-build] The .next directory is inconsistent (likely a rebuild while a server was running," +
      " or a partial rm -rf). Rebuild with `npm run build` — never start the server against this state."
  );
  process.exit(1);
}

console.log(
  `[verify-build] ✓ ${htmlFiles.length} page(s) scanned, 0 missing assets — safe to start.`
);
process.exit(0);
