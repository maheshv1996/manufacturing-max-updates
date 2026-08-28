/**
 * SINGLE SOURCE OF TRUTH for the app version on the Next.js side.
 *
 * `next.config.ts` bakes `APP_VERSION` from package.json into the build env,
 * so in any real build (cloud, dev, desktop) process.env.APP_VERSION is set.
 * The fallback below is a safety net only and must never be bumped by hand —
 * bump the `version` field in package.json and rebuild.
 */
export const APP_VERSION = process.env.APP_VERSION || "1.0.0";
