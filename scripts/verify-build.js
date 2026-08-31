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

// Collect every built server file (HTML, JS chunks, manifests) under .next/server
const scannedFiles = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.name.endsWith(".html") || entry.name.endsWith(".js") || entry.name.endsWith(".json")) {
      scannedFiles.push(p);
    }
  }
})(path.join(nextDir, "server"));

// Also read app-paths-manifest.json for total route count
let pageCount = 0;
const appPathsFile = path.join(nextDir, "server", "app-paths-manifest.json");
if (fs.existsSync(appPathsFile)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(appPathsFile, "utf8"));
    pageCount = Object.keys(manifest).filter(
      (k) => k.endsWith("/page") && !k.startsWith("/_"),
    ).length;
  } catch {}
}

const missing = new Set();
let checkedRefsCount = 0;

for (const file of scannedFiles) {
  const content = fs.readFileSync(file, "utf8");
  const refs = content.match(/\/_next\/static\/[^"')\s\\]+/g) || [];
  for (const ref of refs) {
    // Normalize: strip escaped-quote artifacts and only consider real asset references
    const clean = ref.replace(/[\\?].*$/, "");
    if (!/\.(js|css|woff2?|ttf|png|svg|jpe?g|gif|webp|ico)$/.test(clean)) continue;
    const onDisk = path.join(nextDir, clean.replace(/^\/_next\/static\//, "static/"));
    checkedRefsCount++;
    if (!fs.existsSync(onDisk)) missing.add(clean);
  }
}

if (missing.size > 0) {
  console.error(
    `[verify-build] ✗ ${missing.size} asset(s) referenced by the build are MISSING on disk:`,
  );
  for (const m of missing) console.error(`   ${m}`);
  console.error(
    "[verify-build] The .next directory is inconsistent (likely a rebuild while a server was running," +
      " or a partial rm -rf). Rebuild with `npm run build` — never start the server against this state.",
  );
  process.exit(1);
}

console.log(
  `[verify-build] ✓ Scanned ${scannedFiles.length} server files (${pageCount} App Router pages), verified ${checkedRefsCount} static asset refs. 0 missing assets — safe to start.`,
);
process.exit(0);
