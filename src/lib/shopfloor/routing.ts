/**
 * C2-4 — Pure routing/hold-point advance check (DEPTH_04 W2 step 6, G-2).
 * DB-free: caller passes the routing steps (seq-unique per product — matches
 * `RoutingStep @@unique([productId, seq])`) and the signoff seqs. A unit may
 * advance from `currentSeq` unless that step is a hold point lacking a
 * signoff (PASSED or CONCESSION both release — v1 `HoldPointSignoff.result`).
 */
export interface RoutingStepLike {
  seq: number;
  isHoldPoint: boolean;
}

export interface SignoffLike {
  routingStepSeq: number;
  passed: boolean;
  concession?: boolean;
}

export type AdvanceResult =
  | { allowed: true }
  | { allowed: false; code: "HOLD_POINT_UNSIGNED" | "SEQ_BEYOND_ROUTING"; stepSeq?: number; message: string };

export function advanceCheck(currentSeq: number, steps: RoutingStepLike[], signoffs: SignoffLike[]): AdvanceResult {
  const step = steps.find((s) => s.seq === currentSeq);
  if (!step) {
    return { allowed: false, code: "SEQ_BEYOND_ROUTING", message: `Routing has no step ${currentSeq}` };
  }
  if (!step.isHoldPoint) return { allowed: true };
  const released = signoffs.some((s) => s.routingStepSeq === currentSeq && s.passed);
  if (!released) {
    return {
      allowed: false,
      code: "HOLD_POINT_UNSIGNED",
      stepSeq: currentSeq,
      message: `Hold-point step ${currentSeq} requires an authorized signoff before advancing`,
    };
  }
  return { allowed: true };
}
