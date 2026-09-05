/**
 * C4-1 — Pure ECO state machine (DEPTH_04 W7; schema `EcoStatus`).
 * DRAFT → APPROVED | REJECTED → IMPLEMENTED. Guardrail G-5: IMPLEMENTED is
 * reachable ONLY from APPROVED (an ECO that was never APPROVED with a
 * recorded effectivity cannot be implemented), and APPROVE requires ≥1 item
 * plus a syntactically valid effectivity for its type (DATE = ISO date;
 * SERIAL = N | N+ | A..B). REJECTED/IMPLEMENTED are terminal.
 */
export type EcoStatus = "DRAFT" | "APPROVED" | "IMPLEMENTED" | "REJECTED";
export type EcoEffectivityType = "DATE" | "SERIAL";

export type EcoActionCtx =
  | { action: "APPROVE"; itemCount?: number; effectivityType: EcoEffectivityType; effectivityValue: string }
  | { action: "REJECT"; note?: string }
  | { action: "IMPLEMENT"; note?: string };

export type EcoTransition =
  | { ok: true; status: EcoStatus }
  | { ok: false; code: "NO_ITEMS" | "EFFECTIVITY_INVALID" | "NOTE_REQUIRED" | "ILLEGAL_TRANSITION"; message: string };

const illegal = (from: EcoStatus, action: string): EcoTransition => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} an ECO in state ${from}`,
});

const SERIAL_RE = /^(\d+|\d+\+|\d+\.\.\d+)$/;

function effectivityValid(type: EcoEffectivityType, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (type === "DATE") {
    // ISO date (YYYY-MM-DD or full ISO datetime) that actually parses.
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return false;
    const iso = d.toISOString().slice(0, 10);
    return v.length >= 10 && v.slice(0, 10) === iso;
  }
  return SERIAL_RE.test(v);
}

export function transitionEco(current: EcoStatus, a: EcoActionCtx): EcoTransition {
  switch (a.action) {
    case "APPROVE": {
      if (current !== "DRAFT") return illegal(current, "APPROVE");
      if ((a.itemCount ?? 0) < 1) {
        return { ok: false, code: "NO_ITEMS", message: "An ECO must carry at least one change item to be approved" };
      }
      if (!effectivityValid(a.effectivityType, a.effectivityValue)) {
        return {
          ok: false,
          code: "EFFECTIVITY_INVALID",
          message: `Effectivity '${a.effectivityValue}' is invalid for type ${a.effectivityType} (G-5)`,
        };
      }
      return { ok: true, status: "APPROVED" };
    }
    case "REJECT": {
      if (current !== "DRAFT") return illegal(current, "REJECT");
      if (!a.note?.trim()) {
        return { ok: false, code: "NOTE_REQUIRED", message: "A written note is required to reject an ECO" };
      }
      return { ok: true, status: "REJECTED" };
    }
    case "IMPLEMENT": {
      // G-5: the only legal source state is APPROVED.
      if (current !== "APPROVED") return illegal(current, "IMPLEMENT");
      return { ok: true, status: "IMPLEMENTED" };
    }
  }
}