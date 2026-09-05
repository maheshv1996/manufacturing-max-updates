/**
 * C9-3 — 5S audit scoring (DEPTH_03 F11, v1 parity).
 * Scores are 0–5 integers per audit item; totalPct = round1(Σ / (items × 5) × 100).
 */

import { ok, err, type Result } from "../core/result";

export type FiveSError = "NO_ITEMS" | "INVALID_SCORE";
export const FIVE_S_MAX_SCORE = 5;

export function computeFiveSPct(scores: number[]): Result<number, FiveSError> {
  if (scores.length === 0) return err("NO_ITEMS");
  let sum = 0;
  for (const s of scores) {
    if (!Number.isInteger(s) || s < 0 || s > FIVE_S_MAX_SCORE) return err("INVALID_SCORE");
    sum += s;
  }
  const pct = Math.round((sum / (scores.length * FIVE_S_MAX_SCORE)) * 1000) / 10;
  return ok(pct);
}