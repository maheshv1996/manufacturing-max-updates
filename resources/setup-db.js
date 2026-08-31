"use strict";
/**
 * First-run database loader (desktop v1, offline).
 * Spawned by desktop/lib/embeddedDb.js::applyInitialData with:
 *   ADMIN_URL    — postgres://mfgmax:..@127.0.0.1:5432/postgres  (maintenance DB)
 *   DATABASE_URL — postgres://mfgmax:..@127.0.0.1:5432/mfgmax    (app DB)
 *   APP_DB       — "mfgmax"
 *   SCHEMA_FILE  — resources/schema.sql  (prisma migrations, concatenated)
 *   SEED_DIR     — resources/seedbuild   (compiled prisma/seed.ts)
 *   NODE_PATH    — <standalone>/node_modules (pg + @prisma/* resolve here)
 *
 * Applies schema once, then runs the compiled seed against the app DB.
 */
if (process.env.NODE_PATH) {
  require("module").Module._initPaths();
}
const { Client } = require("pg");

const ADMIN_URL = process.env.ADMIN_URL;
const DB_URL = process.env.DATABASE_URL;
const APP_DB = process.env.APP_DB || "mfgmax";
const SCHEMA_FILE = process.env.SCHEMA_FILE;
const SEED_DIR = process.env.SEED_DIR;

async function main() {
  if (!ADMIN_URL || !DB_URL) throw new Error("ADMIN_URL / DATABASE_URL required");

  // 1. Create the app database (idempotent).
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [APP_DB]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${APP_DB}"`);
    console.log("[setup-db] created database " + APP_DB);
  } else {
    console.log("[setup-db] database " + APP_DB + " already exists");
  }
  await admin.end();

  // 2. Connect to the app DB and decide what still needs doing. This is
  //    idempotent on purpose: if the launcher dies between the seed and the
  //    `.initialized` marker write, the next boot re-runs us and must not
  //    corrupt a working database or double-apply the schema.
  //    Order matters: a FRESH EMPTY database has no tables at all, so the
  //    "already seeded?" probe must come AFTER the table census — querying
  //    `"User"` first would throw `relation "User" does not exist` and kill
  //    first-run provisioning.
  const app = new Client({ connectionString: DB_URL });
  await app.connect();
  const hasTables = await app.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
  );
  if (hasTables.rows[0].n > 0) {
    // Schema present: already seeded -> skip, or partial first run -> reset.
    let users = { rows: [{ n: 0 }] };
    try {
      users = await app.query(`SELECT count(*)::int AS n FROM "User"`);
    } catch {
      // Schema partially applied without "User" — treat as partial, reset.
    }
    if (users.rows[0].n > 0) {
      console.log(`[setup-db] already initialized (${users.rows[0].n} users) — skipping`);
      await app.end();
      return;
    }
    // Partial first run (schema applied, seed never finished). Fresh database
    // with nothing to preserve — reset so the schema applies cleanly again.
    console.log(`[setup-db] partial schema present (${hasTables.rows[0].n} tables) — resetting`);
    await app.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  }

  // 3. Apply the schema (prisma migrate diff DDL, generated at build time).
  const schema = require("fs").readFileSync(SCHEMA_FILE, "utf8");
  await app.query(schema);
  console.log("[setup-db] schema applied (" + schema.length + " bytes)");
  await app.end();

  // 3. Run the compiled seed (connects via DATABASE_URL, uses prisma client
  //    from the standalone bundle resolved through NODE_PATH).
  const { spawnSync } = require("child_process");
  const seedScript = require("path").join(SEED_DIR, "prisma", "seed.js");
  const r = spawnSync(process.execPath, [
    "-e",
    `if(process.env.NODE_PATH)require('module').Module._initPaths();require('${seedScript.replace(/\\/g, '\\\\')}')`
  ], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600_000,
  });
  if (r.status !== 0) {
    const errText = (r.stderr || r.stdout || "").toString().trim();
    throw new Error("seed failed with status " + r.status + (errText ? ": " + errText : ""));
  }
  console.log("[setup-db] seed complete");
}

main()
  .then(() => {
    console.log("[setup-db] DONE");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[setup-db] FAILED:", err.message);
    process.exit(1);
  });
