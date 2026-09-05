#!/usr/bin/env node
/**
 * C6-6 login helper — obtains an app_session cookie from /api/auth/login.
 *
 * Usage:
 *   node scripts/v2-login.mjs [--url http://localhost:3000] [--user admin] [--pass factory123]
 *
 * Prints the cookie value to stdout on success, or exits non-zero on failure.
 */

import http from "node:http";

const args = process.argv.slice(2);
const parseArg = (flag, def) => {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return def;
};

const baseUrl = parseArg("--url", "http://localhost:3000");
const username = parseArg("--user", "admin");
const password = parseArg("--pass", "factory123");

function request(method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        const cookies = [];
        const setCookie = res.headers["set-cookie"];
        if (Array.isArray(setCookie)) {
          for (const c of setCookie) {
            const name = c.split(";")[0].split("=")[0];
            const value = c.split(";")[0].split("=")[1];
            if (name === "app_session") cookies.push(value);
          }
        }
        resolve({ status: res.statusCode, body: parsed, cookies });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  log(`logging in as ${username} against ${baseUrl}/api/auth/login`);
  const r = await request("POST", "/api/auth/login", { username, password });
  if (r.status !== 200 || r.body.error) {
    console.error(`login failed: ${r.status} ${JSON.stringify(r.body)}`);
    process.exit(1);
  }
  const cookie = r.cookies[0];
  if (!cookie) {
    console.error("login response missing app_session cookie");
    process.exit(1);
  }
  // Print cookie to stdout for consumption by smoke-routes
  console.log(cookie);
}

function log(msg) { console.error(`[v2-login] ${msg}`); }
main().catch((e) => { console.error(e); process.exit(1); });
