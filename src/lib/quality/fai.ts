/**
 * C3-3 — Pure FAI (AS9102) state machine (DEPTH_04 W6; schema `FaiReportStatus`).
 * IN_PROGRESS → SUBMITTED → APPROVED | REJECTED. SUBMIT requires at least one
 * characteristic and every FAIL characteristic to carry a deviation
 * justification (deviations are never silently submitted). APPROVED is what
 * satisfies guardrail G-1 in the shopfloor path (C2 `assertFaiGate`).
 */
export type FaiStatus = "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface FaiCharacteristicLike {
  id: string;
  pass: boolean;
  deviationJustified?: boolean;
}

export type FaiActionCtx =
  | { action: "SUBMIT"; characteristics?: FaiCharacteristicLike[] }
  | { action: "DECIDE"; approve: boolean; characteristics?: FaiCharacteristicLike[] };

export type FaiTransition =
  | { ok: true; status: FaiStatus }
  | {
      ok: false;
      code: "NO_CHARACTERISTICS" | "UNJUSTIFIED_DEVIATION" | "ILLEGAL_TRANSITION";
      message: string;
      characteristics?: string[];
    };

const illegal = (from: FaiStatus, action: string): FaiTransition => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} an FAI report in state ${from}`,
});

export function transitionFai(current: FaiStatus, a: FaiActionCtx): FaiTransition {
  switch (a.action) {
    case "SUBMIT": {
      if (current !== "IN_PROGRESS") return illegal(current, "SUBMIT");
      if ((a.characteristics ?? []).length === 0) {
        return { ok: false, code: "NO_CHARACTERISTICS", message: "At least one characteristic is required before submission" };
      }
      const unjustified = (a.characteristics ?? [])
        .filter((c) => !c.pass && c.deviationJustified !== true)
        .map((c) => c.id);
      if (unjustified.length > 0) {
        return {
          ok: false,
          code: "UNJUSTIFIED_DEVIATION",
          message: `Deviations need justification before submission: ${unjustified.join(", ")}`,
          characteristics: unjustified,
        };
      }
      return { ok: true, status: "SUBMITTED" };
    }
    case "DECIDE": {
      if (current !== "SUBMITTED") return illegal(current, "DECIDE");
      return { ok: true, status: a.approve ? "APPROVED" : "REJECTED" };
    }
  }
}