"use strict";
/**
 * Offline idempotency prune — keeps IdempotencyKey bounded on the embedded DB.
 * Works with both embedded Postgres (pg Pool) and file SQLite (node:sqlite).
 * Called daily by DesktopApp.scheduleIdempotencyPrune().
 */
const fs = require("fs");
const path = require("path");

async function pruneIdempotency({ databaseUrl, days = 7, log = () => {} }) {
  const cutoff = new Date(Date.now() - days * 86400000);
  const url = databaseUrl || process.env.DATABASE_URL || "";

  if (url.startsWith("postgres")) {
    // Embedded Postgres path — use pg Pool directly (no Prisma needed in launcher)
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 5000, connectionTimeoutMillis: 5000 });
    try {
      const res = await pool.query('DELETE FROM "IdempotencyKey" WHERE "createdAt" < $1', [cutoff]);
      return res.rowCount || 0;
    } finally {
      await pool.end().catch(() => {});
    }
  }

  // File SQLite path — file:./app.db or file:C:/.../app.db
  const fileMatch = url.match(/^file:(.+)$/);
  const dataDirFromUrl = fileMatch ? path.dirname(path.resolve(fileMatch[1])) : null;
  const candidates = [];
  if (dataDirFromUrl) candidates.push(path.join(dataDirFromUrl, "app.db"), path.join(dataDirFromUrl, "app.sqlite"), path.join(dataDirFromUrl, "data.db"));
  // Also try common dataDir locations from launcher context
  const fallbackDirs = [process.env.MFGMAX_DATA_DIR, process.env.DATA_DIR].filter(Boolean).map((d) => path.resolve(d));
  for (const d of fallbackDirs) {
    candidates.push(path.join(d, "app.db"), path.join(d, "app.sqlite"));
  }

  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) {
    log(`[prune] no SQLite file found for ${url} — skipping`);
    return 0;
  }

  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(file);
    try {
      // Table may not exist yet on fresh installs before first migration — ignore
      const stmt = db.prepare('DELETE FROM "IdempotencyKey" WHERE "createdAt" < ?');
      const res = stmt.run(cutoff.toISOString());
      return res.changes || 0;
    } finally {
      db.close();
    }
  } catch (e) {
    // node:sqlite unavailable or table missing — not fatal
    if (String(e && e.message).includes('no such table')) return 0;
    throw e;
  }
}

module.exports = { pruneIdempotency };
