"use strict";
/**
 * ADVISORY ONLINE LICENSE RE-VERIFY (v1.1)
 * ----------------------------------------
 * When internet exists, the launcher can ask the vendor's license server
 * whether the installed key is still valid (revocation / renewal checks).
 *
 * This check is STRICTLY ADVISORY:
 *  - The offline gate (license.evaluateActivation) remains the source of truth,
 *    so the 14-day GRACE window and offline activation are untouched.
 *  - Any failure — timeout, DNS, HTTP error, malformed body — resolves to a
 *    non-throwing result and the launcher simply keeps the offline state.
 *    Offline NEVER blocks login.
 *
 * Env: MFGMAX_LICENSE_SERVER (optional). Unset => feature disabled.
 * Expected response: 200 JSON { status: "ACTIVE"|"EXPIRED"|"INVALID"|"GRACE",
 *                                reason?: string }
 */
const https = require("https");
const http = require("http");

/**
 * @param {object} opts
 * @param {string} [opts.serverUrl]  e.g. https://vendor.example.com/api/license/verify
 * @param {string} [opts.key]        installed license key
 * @param {string} opts.machineId    machine fingerprint
 * @param {number} [opts.timeoutMs]  default 5000
 * @returns {Promise<{ok:boolean, offline:boolean, status?:string, reason:string}>}
 */
function reVerifyOnline({ serverUrl, key, machineId, timeoutMs = 5000 }) {
  return new Promise((resolve) => {
    if (!serverUrl) {
      return resolve({ ok: false, offline: true, reason: "DISABLED" });
    }
    let url;
    try {
      url = new URL(serverUrl);
    } catch {
      return resolve({ ok: false, offline: true, reason: "BAD_SERVER_URL" });
    }
    url.searchParams.set("machine", machineId);
    if (key) url.searchParams.set("key", key);

    const lib = url.protocol === "http:" ? http : https;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return resolve({ ok: false, offline: false, reason: `HTTP_${res.statusCode}` });
        }
        try {
          const data = JSON.parse(body);
          if (data && typeof data.status === "string") {
            return resolve({ ok: true, offline: false, status: data.status, reason: data.reason || "OK" });
          }
        } catch {
          /* fall through */
        }
        return resolve({ ok: false, offline: false, reason: "BAD_RESPONSE" });
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, offline: true, reason: "TIMEOUT" });
    });
    req.on("error", () => resolve({ ok: false, offline: true, reason: "NETWORK" }));
  });
}

module.exports = { reVerifyOnline };
