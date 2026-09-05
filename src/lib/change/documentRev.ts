/**
 * C4-3 — Pure document revision issuing (DEPTH_04 W7; F4 "no-delete/archive").
 * Revisions only move forward (numeric-aware); a superseded revision is
 * archived, never overwritten or deleted. The floor may reference only the
 * current revision (`canUseRev`).
 */
import { compareRevs } from "./revision";

export type IssueResult =
  | { ok: true; nextRev: string }
  | { ok: false; code: "REV_NOT_FORWARD"; message: string };

export function issueRevision(currentRev: string, newRev: string): IssueResult {
  const cur = currentRev.trim();
  const next = newRev.trim();
  if (!cur || !next || cur === next || compareRevs(next, cur) <= 0) {
    return {
      ok: false,
      code: "REV_NOT_FORWARD",
      message: `New revision '${newRev}' does not supersede '${currentRev}' (revisions only move forward)`,
    };
  }
  return { ok: true, nextRev: next };
}

export type UseResult = { ok: true } | { ok: false; code: "OBSOLETE_REV"; message: string };

export function canUseRev(currentRev: string, usedRev: string): UseResult {
  if (usedRev === currentRev) return { ok: true };
  return {
    ok: false,
    code: "OBSOLETE_REV",
    message: `Revision ${usedRev} is obsolete — only ${currentRev} may be used on the floor`,
  };
}