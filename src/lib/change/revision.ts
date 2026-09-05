/**
 * C4-2 — Pure revision law (DEPTH_04 W7, "revisions become law").
 * The floor can only ever reference the CURRENT revision: mismatches are
 * obsolete. WOs starting before a DATE effectivity may legally use the old
 * revision; from the effectivity date onward the new revision is law
 * (G-5 consequence). SERIAL effectivity splits are enforced per serial unit
 * once genealogy lands — default here: new revision required.
 */
export function compareRevs(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isInteger(na) && Number.isInteger(nb)) return na === nb ? 0 : na > nb ? 1 : -1;
  return a === b ? 0 : a > b ? 1 : -1;
}

export function isObsoleteRev(currentRev: string, usedRev: string): boolean {
  return usedRev !== currentRev;
}

export type WoAllowedRev =
  | { allowed: true; requiredRev: string }
  | { allowed: false; requiredRev: string };

export function woAllowedRev(input: {
  woStart: Date;
  effectivityType: "DATE" | "SERIAL";
  effectivityDate?: Date;
}): WoAllowedRev {
  if (input.effectivityType === "DATE") {
    const at = input.effectivityDate ?? new Date();
    if (input.woStart.getTime() < at.getTime()) {
      return { allowed: true, requiredRev: "current" };
    }
    return { allowed: false, requiredRev: "current" };
  }
  // SERIAL effectivity: per-unit split enforced with genealogy; WOs default to new rev.
  return { allowed: false, requiredRev: "current" };
}

export interface RevisionGap {
  ready: boolean;
  gapCode: "DRAWING_REV" | null;
  message?: string;
}

/** C2-3 readiness-shaped output for the floor consequence. */
export function revisionGap(input: { currentRev: string; usedRev: string }): RevisionGap {
  if (isObsoleteRev(input.currentRev, input.usedRev)) {
    return {
      ready: false,
      gapCode: "DRAWING_REV",
      message: `Drawing revision ${input.usedRev} is obsolete — current is ${input.currentRev}`,
    };
  }
  return { ready: true, gapCode: null };
}