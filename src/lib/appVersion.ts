/**
 * SINGLE SOURCE OF TRUTH for application versioning.
 *
 * Grounded in Semantic Versioning (SemVer 2.0.0).
 * Bakes process.env.APP_VERSION (configured via next.config.ts / package.json)
 * and exports typed structured metadata.
 */

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  tag?: string;
  full: string;
  isDev: boolean;
}

export function parseSemanticVersion(versionString?: string | null): SemanticVersion {
  const raw = String(versionString || "").trim();
  const fallbackVersion = process.env.NODE_ENV === "development" ? "1.0.0-dev" : "1.0.0";
  const semverStr = (raw || process.env.APP_VERSION || fallbackVersion).trim();

  // Strip optional leading 'v' or 'V'
  const normalizedStr = semverStr.replace(/^v/i, "");
  const match = normalizedStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);

  if (!match) {
    return {
      major: 1,
      minor: 0,
      patch: 0,
      tag: "dev",
      full: semverStr,
      isDev: true,
    };
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const tag = match[4];

  return {
    major: Number.isFinite(major) ? major : 1,
    minor: Number.isFinite(minor) ? minor : 0,
    patch: Number.isFinite(patch) ? patch : 0,
    tag,
    full: semverStr,
    isDev: Boolean(tag?.toLowerCase().includes("dev") || process.env.NODE_ENV === "development"),
  };
}

export const CURRENT_SEMVER = parseSemanticVersion(process.env.APP_VERSION);
export const APP_VERSION = CURRENT_SEMVER.full;
