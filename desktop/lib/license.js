"use strict";
/**
 * OFFLINE LICENSING (Phase 4)
 * --------------------------
 * License key = base64(JSON payload) + "." + HMAC-SHA256 signature.
 * Payload: { plan, expiresAt (ISO), machineId, issuedAt }.
 *
 * Honest notes:
 *  - This deters casual copying; a determined user can patch the binary.
 *    Treat it as commercial friction, not DRM.
 *  - Machine fingerprint = disk serial (first physical disk) + OS-level
 *    identifiers, all read without native modules. `readDiskSerial()` uses
 *    wmic -> PowerShell CIM -> lsblk fallbacks so the fingerprint stays pure
 *    Node (see EXTENSION POINT below).
 *
 * Pure Node (crypto + child_process only) — no dependencies, unit-testable
 * offline.
 */
const crypto = require("crypto");
const os = require("os");
const { spawnSync } = require("child_process");

// ---------------------------------------------------------------------------
// MACHINE FINGERPRINT
// ---------------------------------------------------------------------------
/**
 * First physical disk serial, or "" when no tool is available. Windows:
 * wmic (fast, where present) -> PowerShell CIM fallback. Linux: lsblk.
 */
function readDiskSerial() {
  try {
    if (process.platform === "win32") {
      const wmic = spawnSync("wmic", ["diskdrive", "get", "serialnumber"], { encoding: "utf8", windowsHide: true, timeout: 10_000 });
      const wmicLines = (wmic.stdout || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^serialnumber$/i.test(l));
      if (wmicLines.length > 0) return wmicLines[0].replace(/\s+/g, "");

      const ps = spawnSync("powershell", ["-NoProfile", "-Command", "(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber"], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
      const p = (ps.stdout || "").trim();
      if (p) return p.replace(/\s+/g, "");
    } else {
      const lsblk = spawnSync("lsblk", ["-no", "SERIAL", "/dev/sda"], { encoding: "utf8", timeout: 10_000 });
      const l = (lsblk.stdout || "").trim();
      if (l) return l;
    }
  } catch {
    /* any failure -> no disk serial in fingerprint */
  }
  return "";
}

function fingerprint() {
  const disk = readDiskSerial();
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || "",
    os.totalmem(),
    os.machine && os.machine(),
  ];
  const raw = (disk ? disk + "|" : "") + parts.filter(Boolean).join("|");
  // EXTENSION POINT: prepend a real CPU-id / TPM read here, e.g.
  //   raw = await readCpuId() + "|" + raw;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// KEY CREATION & VERIFICATION
// ---------------------------------------------------------------------------
function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(key, secret) {
  if (!key || typeof key !== "string") return { valid: false, reason: "MISSING" };
  const parts = key.split(".");
  if (parts.length !== 2) return { valid: false, reason: "MALFORMED" };
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { valid: false, reason: "BAD_SIGNATURE" };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "BAD_PAYLOAD" };
  }
  return { valid: true, reason: "OK", payload };
}

// ---------------------------------------------------------------------------
// ACTIVATION STATE MACHINE
// ---------------------------------------------------------------------------
// Returns one of:
//   ACTIVE   — valid key, not expired, bound to this machine
//   EXPIRED  — valid key, date passed
//   GRACE    — no valid key but within grace window of first run / hardware change
//   INVALID  — key missing/signature bad/machine mismatch
function evaluateActivation({ key, secret, machineId, firstSeenDate, now = Date.now(), graceDays = 14 }) {
  const stateFileDate = firstSeenDate ? new Date(firstSeenDate).getTime() : null;
  const nowMs = new Date(now).getTime();

  const result = verify(key, secret);
  if (result.valid) {
    if (result.payload.machineId && result.payload.machineId !== machineId) {
      // License bound to a different machine — allow a grace window so a
      // hardware change (new disk, new CPU) doesn't brick the plant.
      const graceUntil = (stateFileDate ?? nowMs) + graceDays * 86400_000;
      if (nowMs <= graceUntil) {
        return { status: "GRACE", reason: "MACHINE_CHANGED", graceUntil: new Date(graceUntil).toISOString() };
      }
      return { status: "INVALID", reason: "MACHINE_MISMATCH" };
    }
    const expires = new Date(result.payload.expiresAt).getTime();
    if (expires < nowMs) {
      return { status: "EXPIRED", reason: "DATE_PASSED", expiresAt: result.payload.expiresAt };
    }
    return { status: "ACTIVE", reason: "OK", payload: result.payload, expiresAt: result.payload.expiresAt };
  }

  // No/invalid key: grace from first run.
  if (stateFileDate) {
    const graceUntil = stateFileDate + graceDays * 86400_000;
    if (nowMs <= graceUntil) {
      return { status: "GRACE", reason: result.reason, graceUntil: new Date(graceUntil).toISOString() };
    }
  }
  return { status: "INVALID", reason: result.reason };
}

module.exports = { fingerprint, sign, verify, evaluateActivation };
