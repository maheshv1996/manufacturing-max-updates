#!/usr/bin/env node
/**
 * build-desktop-resources — generates the offline-installer data artifacts:
 *
 *   1. resources/schema.sql      — prisma migrations concatenated in order
 *   2. resources/seedbuild/      — prisma/seed.ts + src/lib/prisma.ts compiled
 *                                  to CommonJS (dotenv import stripped; the
 *                                  launcher passes DATABASE_URL via env)
 *
 * Run before `npm run dist`. Both artifacts are plain files — no prisma CLI
 * or client tools are needed at runtime on the factory PC.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const resourcesDir = path.join(root, "resources");
const migrationsDir = path.join(root, "prisma", "migrations");
const seedFile = path.join(root, "prisma", "seed.ts");
const prismaLib = path.join(root, "src", "lib", "prisma.ts");

fs.mkdirSync(resourcesDir, { recursive: true });

// ---- 0. complete the standalone output ------------------------------------
// Next.js `output: standalone` does NOT copy .next/static or public into the
// standalone dir — the standalone server would 404 every CSS/JS asset. Copy
// them in so the packaged app is fully self-contained (Phase 1 of the spec).
const standaloneDir = path.join(root, ".next", "standalone");
if (fs.existsSync(standaloneDir)) {
  fs.cpSync(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"), { recursive: true });
  fs.cpSync(path.join(root, "public"), path.join(standaloneDir, "public"), { recursive: true });
  const rogueDist = path.join(standaloneDir, "dist");
  if (fs.existsSync(rogueDist)) {
    fs.rmSync(rogueDist, { recursive: true, force: true });
    console.log("[desktop-resources] Cleaned rogue dist directory from standalone");
  }
  console.log("[desktop-resources] standalone completed: .next/static + public copied in");
} else {
  console.warn("[desktop-resources] WARNING: .next/standalone not found — run `npm run build` first");
}

// ---- 1. schema.sql ---------------------------------------------------------
// Generate the full DDL from schema.prisma with the prisma schema engine
// (offline, no database needed). This is the authoritative schema — the
// migrations in this repo only cover the first 17 tables (the dev DB drifted
// via `prisma db push`), so concatenating migrations would produce a broken
// install. `migrate diff --from-empty --to-schema` reflects the whole datamodel.
try {
  const ddl = execSync(
    `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`,
    { cwd: root, maxBuffer: 20 * 1024 * 1024 }
  ).toString("utf8");
  fs.writeFileSync(path.join(resourcesDir, "schema.sql"), ddl, "utf8");
} catch (e) {
  const msg = String(e.stdout || e.stderr || e.message || "");
  throw new Error("schema generation failed:\n" + msg.slice(0, 1500));
}
const schemaSql = fs.readFileSync(path.join(resourcesDir, "schema.sql"), "utf8");
const tableCount = (schemaSql.match(/CREATE TABLE/g) || []).length;
const enumCount = (schemaSql.match(/CREATE TYPE/g) || []).length;
console.log(`[desktop-resources] schema.sql: ${tableCount} tables, ${enumCount} enums, ${(schemaSql.length / 1024).toFixed(0)} KB`);

// Warn if any statement uses psql meta-commands (not supported by node-pg).
const meta = schemaSql.match(/^\\[a-z]+/gim);
if (meta) {
  console.warn("[desktop-resources] WARNING: schema.sql contains psql meta-commands:", meta.slice(0, 5));
}

// ---- 2. seedbuild (compiled seed) ------------------------------------------
// IMPORTANT: the artifacts are emitted INSIDE the standalone dir
// (.next/standalone/desktop-seed) so plain `require("pg")` / `require("@prisma/client")`
// resolve by walking up into standalone/node_modules. Electron's embedded node
// IGNORES NODE_PATH, so a separate resources/seedbuild with NODE_PATH would
// never find its modules in the packaged app.
const srcDir = path.join(resourcesDir, ".seed-src");
const seedDeployDir = path.join(standaloneDir, "desktop-seed");
const outDir = path.join(seedDeployDir, "seedbuild");
fs.rmSync(srcDir, { recursive: true, force: true });
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(srcDir, "src", "lib"), { recursive: true });

// Keep the prisma/seed.ts -> ../src/lib/* layout so relative imports survive.
const seedSrcDir = path.join(srcDir, "prisma");
const libSrcDir = path.join(srcDir, "src", "lib");
fs.mkdirSync(seedSrcDir, { recursive: true });
fs.mkdirSync(libSrcDir, { recursive: true });

// Patch out the dotenv import — the launcher injects DATABASE_URL via env.
const seedRaw = fs.readFileSync(seedFile, "utf8").replace(/^\s*import\s+["']dotenv\/config["'];\s*$/m, "");
fs.writeFileSync(path.join(seedSrcDir, "seed.ts"), seedRaw);

// Copy full src/lib so all relative imports from seed.ts and its dependencies resolve
fs.cpSync(path.join(root, "src", "lib"), libSrcDir, { recursive: true });

const tscBin = path.join(root, "node_modules", "typescript", "bin", "tsc");
try {
  execSync(
    `"${process.execPath}" "${tscBin}" prisma/seed.ts --outDir "${outDir.replace(/\\/g, "/")}" --module commonjs --target es2020 --esModuleInterop --skipLibCheck --moduleResolution node --rootDir .`,
    { cwd: srcDir, stdio: "pipe" }
  );
} catch (e) {
  const msg = String(e.stdout || e.stderr || e.message || "");
  throw new Error("seed compile failed:\n" + msg.slice(0, 2000));
}

fs.rmSync(srcDir, { recursive: true, force: true });

const outFiles = fs.readdirSync(path.join(outDir, "src", "lib"));
console.log(`[desktop-resources] seedbuild: seed.js + src/lib/*.js (${outFiles.length} files compiled)`);

// ---- 2b. seed runtime deps + env hygiene --------------------------------
// The standalone trace only covers the SERVER's imports. The compiled seed
// uses @prisma/adapter-pg (pg driver adapter), which Next never traced into
// standalone/node_modules — the seed would fail at first run with
// "Cannot find module '@prisma/adapter-pg'". Copy the whole @prisma scope so
// adapter-pg + driver-adapter-utils + debug resolve for the seed.
const prismaScopeSrc = path.join(root, "node_modules", "@prisma");
const prismaScopeDst = path.join(standaloneDir, "node_modules", "@prisma");
if (fs.existsSync(prismaScopeSrc)) {
  fs.mkdirSync(prismaScopeDst, { recursive: true });
  for (const mod of fs.readdirSync(prismaScopeSrc)) {
    const from = path.join(prismaScopeSrc, mod);
    if (fs.statSync(from).isDirectory()) fs.cpSync(from, path.join(prismaScopeDst, mod), { recursive: true });
  }
  console.log("[desktop-resources] @prisma scope copied into standalone (seed runtime deps)");
}

// Next's standalone trace stubs some pg helper packages (package.json only, no
// index.js) because the SERVER never calls them — but the seed's driver adapter
// does. Copy the real modules in.
for (const mod of ["postgres-array", "postgres-bytea", "postgres-date", "postgres-interval"]) {
  const from = path.join(root, "node_modules", mod);
  const to = path.join(standaloneDir, "node_modules", mod);
  if (fs.existsSync(from)) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
  }
}

// Never ship the build machine's .env (cloud DATABASE_URL etc.) inside the
// standalone — the launcher injects the embedded DB URL at runtime. Next's
// standalone output copies .env in; strip it here so no cloud credentials or
// URLs ever leave the build machine.
for (const f of fs.readdirSync(standaloneDir)) {
  if (f === ".env" || f.startsWith(".env.")) {
    fs.rmSync(path.join(standaloneDir, f), { force: true });
    console.log("[desktop-resources] stripped " + f + " from standalone");
  }
}

// Co-locate schema.sql + setup-db.js with the seedbuild inside the standalone.
fs.copyFileSync(path.join(resourcesDir, "schema.sql"), path.join(seedDeployDir, "schema.sql"));
fs.copyFileSync(path.join(resourcesDir, "setup-db.js"), path.join(seedDeployDir, "setup-db.js"));
console.log("[desktop-resources] desktop-seed bundle: " + seedDeployDir);

// ---- 3. make the standalone survive electron-builder ------------------------
// electron-builder extraResources drops dot-dirs (.next) and node_modules no
// matter what filter is set. Rename them so packaging keeps them; the launcher
// restores the names at first server start (instant rename, offline).
const dotNext = path.join(standaloneDir, ".next");
const nm = path.join(standaloneDir, "node_modules");
if (fs.existsSync(dotNext)) {
  fs.rmSync(path.join(standaloneDir, "nextdir"), { recursive: true, force: true });
  fs.renameSync(dotNext, path.join(standaloneDir, "nextdir"));
}
if (fs.existsSync(nm)) {
  fs.rmSync(path.join(standaloneDir, "modules"), { recursive: true, force: true });
  fs.renameSync(nm, path.join(standaloneDir, "modules"));
}
console.log("[desktop-resources] standalone prepared for packaging (.next -> nextdir, node_modules -> modules)");
console.log("[desktop-resources] done — ready for `npm run dist`.");
