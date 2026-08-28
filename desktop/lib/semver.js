"use strict";
/**
 * Minimal semver comparison (no deps). Supports `x.y.z` and optional
 * `-pre` suffix. Returns:
 *   1  if a > b
 *   0  if a == b
 *  -1  if a < b
 */
function parse(v) {
  const m = String(v || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null };
}

function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return NaN;
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  // Pre-release: 1.0.0-alpha < 1.0.0
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre === pb.pre) return 0;
  return pa.pre > pb.pre ? 1 : -1;
}

function isNewer(candidate, current) {
  const c = compare(candidate, current);
  return Number.isFinite(c) && c > 0;
}

module.exports = { parse, compare, isNewer };
