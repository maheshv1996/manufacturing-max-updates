"use strict";
/**
 * Minimal SQLite read helper for the desktop launcher's seed-if-empty check.
 * Uses Node's built-in `node:sqlite` (Node >= 22.5) so there is no native
 * dependency. If unavailable, reports 0 users (treats DB as needing seed).
 */
const fs = require("fs");
const path = require("path");

function countUsers(dataDir) {
  const candidates = ["app.db", "app.sqlite", "data.db"].map((f) => path.join(dataDir, f));
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) return 0;

  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const row = db.prepare('SELECT count(*) AS n FROM "User"').get();
      return Number(row?.n || 0);
    } finally {
      db.close();
    }
  } catch {
    // node:sqlite unavailable or schema not ready — assume needs seeding.
    return 0;
  }
}

module.exports = { countUsers };
