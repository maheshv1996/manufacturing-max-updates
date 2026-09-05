#!/usr/bin/env node
/**
 * One-command v2 scratch-DB reset for cycle smokes (authoring-safe).
 * Recreates <name> (default mfgmax_v2_test) on the LOCAL Postgres, pushes the
 * full Prisma schema, and runs the v2 seed. Never touches any remote DB — the
 * base URL must point at localhost (override with V2_PG_URL).
 *
 * Usage:
 *   node scripts/v2-smoke-db.mjs [dbname]
 *   V2_PG_URL="postgresql://postgres:1996@localhost:5432" node scripts/v2-smoke-db.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbName = (process.argv[2] || "mfgmax_v2_test").replace(/[^a-zA-Z0-9_]/g, "");
const base = process.env.V2_PG_URL || "postgresql://postgres:1996@localhost:5432";
const url = `${base}/${dbName}`;

if (!base.includes("localhost") && !base.includes("127.0.0.1")) {
  console.error(`Refusing to run against non-local Postgres: ${base}`);
  process.exit(1);
}

const admin = new pg.Client({ connectionString: base, database: undefined });
await admin.connect();
try {
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`[v2-smoke-db] recreated "${dbName}"`);
} finally {
  await admin.end();
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  const tail = (r.stdout || "").trim().split("\n").slice(-4).join("\n");
  const errTail = (r.stderr || "").trim().split("\n").slice(-4).join("\n");
  console.log(tail || errTail);
  if (r.status !== 0) {
    console.error(`[v2-smoke-db] FAILED: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

run(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--url", url]);
run(process.execPath, ["--import", "tsx", "prisma/seed-v2.ts"], { DATABASE_URL: url });
console.log(`[v2-smoke-db] ready: ${url}`);
