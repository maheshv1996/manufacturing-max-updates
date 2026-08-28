#!/usr/bin/env node
/**
 * Full-app sweep against a running server with an admin session.
 *   - GETs every static page (200 = renders, 500 = crash, 307 = auth redirect)
 *   - GETs every no-param API route (200 = works; 405/400 = method/param semantics,
 *     not failures; 500 = crash)
 * Usage: node scripts/sweep-app.mjs [baseUrl]   (default http://localhost:3000)
 */
import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = process.argv[2] || "http://localhost:3000";
const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "app");

const pages = [];
const apiStatic = [];
const apiDynamic = [];

(function walk(dir, urlPath) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "fonts") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, urlPath + "/" + e.name);
    } else if (e.name === "page.tsx") {
      pages.push(urlPath === "" ? "/" : urlPath);
    } else if (e.name === "route.ts" && urlPath.startsWith("/api")) {
      if (urlPath.includes("[")) apiDynamic.push(urlPath);
      else apiStatic.push(urlPath);
    }
  }
})(APP_ROOT, "");

const report = { pages: { ok: [], redirect: [], crash: [], other: [] }, api: { ok: [], note: [], crash: [], other: [] } };

async function login() {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "1001", password: "factory123" }),
  });
  if (!res.ok) throw new Error("login failed: " + res.status + " " + (await res.text()).slice(0, 200));
  const sc = res.headers.get("set-cookie");
  if (!sc) throw new Error("no session cookie from login");
  return sc.split(";")[0];
}

async function pool(items, worker, concurrency = 6) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

const cookie = await login();
console.log(`sweeping ${pages.length} pages + ${apiStatic.length} static APIs on ${BASE}`);

const pageRes = await pool(pages, async (p) => {
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + p, { headers: { Cookie: cookie }, redirect: "manual" });
    return { path: p, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { path: p, status: -1, ms: 0, error: e.message };
  }
});

const apiRes = await pool(apiStatic, async (p) => {
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + p, { headers: { Cookie: cookie }, redirect: "manual" });
    return { path: p, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { path: p, status: -1, ms: 0, error: e.message };
  }
});

for (const r of pageRes) {
  if (r.status === 200) report.pages.ok.push(r);
  else if (r.status === 307 || r.status === 302) report.pages.redirect.push(r);
  else if (r.status >= 500 || r.status === -1) report.pages.crash.push(r);
  else report.pages.other.push(r);
}
for (const r of apiRes) {
  if (r.status === 200) report.api.ok.push(r);
  else if (r.status === 400 || r.status === 404 || r.status === 405 || r.status === 422) report.api.note.push(r);
  else if (r.status >= 500 || r.status === -1) report.api.crash.push(r);
  else report.api.other.push(r);
}

const fmt = (arr) => arr.map((r) => `${r.status} ${r.ms}ms ${r.path}${r.error ? " ERR:" + r.error : ""}`);

console.log("\n=== PAGES ===");
console.log(`OK ${report.pages.ok.length} | crash ${report.pages.crash.length} | redirect ${report.pages.redirect.length} | other ${report.pages.other.length}`);
if (report.pages.crash.length) { console.log("--- CRASHES ---"); console.log(fmt(report.pages.crash).join("\n")); }
if (report.pages.redirect.length) { console.log("--- REDIRECTS (need session/permission?) ---"); console.log(fmt(report.pages.redirect).join("\n")); }
if (report.pages.other.length) { console.log("--- OTHER ---"); console.log(fmt(report.pages.other).join("\n")); }

console.log("\n=== APIs (static, no params) ===");
console.log(`OK ${report.api.ok.length} | note ${report.api.note.length} | crash ${report.api.crash.length} | other ${report.api.other.length}`);
if (report.api.crash.length) { console.log("--- CRASHES ---"); console.log(fmt(report.api.crash).join("\n")); }
if (report.api.other.length) { console.log("--- OTHER (4xx) ---"); console.log(fmt(report.api.other).join("\n")); }
if (report.api.note.length) { console.log(`--- NOTES (expected semantics, ${report.api.note.length}) ---`); console.log(fmt(report.api.note).join("\n")); }

console.log(`\n=== DYNAMIC API routes (skipped, need ids): ${apiDynamic.length} ===`);
console.log(apiDynamic.join("\n"));

const failed = report.pages.crash.length + report.pages.redirect.length + report.api.crash.length + report.api.other.length;
process.exit(failed > 0 ? 1 : 0);
