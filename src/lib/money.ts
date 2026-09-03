/**
 * Fixed-point money helpers (paise = 1/100 rupee).
 * ------------------------------------------------
 * Ledger amounts are stored and summed as INTEGER paise so double-entry
 * arithmetic is exact — no floating-point dust can unbalance a journal or
 * silently shift a trial balance. Rupee floats are only ever accepted at the
 * API boundary and converted here; every engine/DB value below is a whole
 * number of paise (JavaScript doubles hold integers < 2^53 exactly).
 *
 * Conversions:
 *   toPaise(12.345) === 1235   (round-half-away-from-zero at the paise)
 *   fromPaise(1235) === 12.35  (exact 2dp — /100 prints back cleanly)
 */

export const PAISE_PER_RUPEE = 100;

/** Round to the nearest paise (half away from zero) and return integer paise. */
export function toPaise(rupees: number): number {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  const scaled = n * PAISE_PER_RUPEE;
  return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
}

/** Exact rupee value (2dp) for a paise amount — /100 on an integer is exact. */
export function fromPaise(paise: number): number {
  const n = Number(paise);
  if (!Number.isFinite(n)) return 0;
  return n / PAISE_PER_RUPEE;
}

/** True when a value is an integral number of paise (no sub-paise dust). */
export function isIntegralPaise(n: number): boolean {
  return Number.isFinite(n) && Math.round(n) === n;
}

/** Round a rupee float to clean 2dp (display / document-side amounts only). */
export function roundRupees(rupees: number): number {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * PAISE_PER_RUPEE) / PAISE_PER_RUPEE;
}

/** Format paise as an Indian-locale rupee string: formatRupees(fromPaise(n)). */
export function formatRupees(paise: number): string {
  return fromPaise(paise).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
