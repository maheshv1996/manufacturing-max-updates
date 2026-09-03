/**
 * MRB disposition policy — pure functions shared by the API route and the
 * committed regression tests. Kept DB-free so the guard logic (which used to
 * 500 the Disposition button for everyone) is unit-testable.
 *
 * The schema stores enum-valued strings; anything else used to reach Prisma
 * and throw. normalize* returns the canonical enum string or undefined, so
 * callers can 400 cleanly instead of crashing.
 */

export const MRB_DISPOSITIONS = [
  "USE_AS_IS",
  "REWORK",
  "SCRAP",
  "RETURN_TO_SUPPLIER",
] as const;

export const MRB_AUTHORITIES = ["QUALITY", "ENGINEERING", "CUSTOMER"] as const;

export type MrbDisposition = (typeof MRB_DISPOSITIONS)[number];
export type MrbAuthority = (typeof MRB_AUTHORITIES)[number];

/** Canonical disposition enum value, coercing the legacy RETURN_TO_VENDOR UI label. */
export function normalizeMrbDisposition(v: unknown): MrbDisposition | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim().toUpperCase();
  if (s === "RETURN_TO_VENDOR") return "RETURN_TO_SUPPLIER"; // legacy UI label → schema enum
  return (MRB_DISPOSITIONS as readonly string[]).includes(s) ? (s as MrbDisposition) : undefined;
}

/** Canonical disposition-authority enum value (QUALITY/ENGINEERING/CUSTOMER). */
export function normalizeMrbAuthority(v: unknown): MrbAuthority | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim().toUpperCase();
  return (MRB_AUTHORITIES as readonly string[]).includes(s) ? (s as MrbAuthority) : undefined;
}
