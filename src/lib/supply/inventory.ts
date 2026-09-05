/**
 * C5-3 Inventory movement + cycle-count core.
 * Pure reducer over a balance; every movement returns the write-intent for the
 * ledger. W12: cycle-count variance needs authority + reason beyond tolerance.
 */
export type MovementType = "IN" | "OUT" | "ADJUST";

export type MovementTx = {
  type: MovementType;
  qty: number;
  reason?: string;
  actor?: string;
  reference?: string;
};

export type MovementState = { balance: number };

export type MovementResult =
  | { ok: true; state: MovementState; write: MovementTx }
  | { ok: false; code: "NEGATIVE_STOCK" | "ADJUST_REASON_REQUIRED" | "QTY_INVALID" };

export function applyMovement(state: MovementState, tx: MovementTx): MovementResult {
  if (tx.type !== "ADJUST" && tx.qty < 0) return { ok: false, code: "QTY_INVALID" };
  if (tx.type === "ADJUST" && !tx.reason) return { ok: false, code: "ADJUST_REASON_REQUIRED" };

  const delta = tx.type === "OUT" ? -tx.qty : tx.qty;
  const next = state.balance + delta;
  if (next < 0) return { ok: false, code: "NEGATIVE_STOCK" };

  return { ok: true, state: { balance: next }, write: tx };
}

export type Variance = { within: boolean; variance: number };

export function varianceCheck(bookQty: number, countedQty: number, tolerancePct: number): Variance {
  const variance = countedQty - bookQty;
  const maxAbs = (bookQty * tolerancePct) / 100;
  return { within: Math.abs(variance) <= maxAbs, variance };
}

export type AdjustmentCtx = { authority?: boolean; reason?: string };
export type AdjustmentResult = { ok: true } | { ok: false; code: "REASON_REQUIRED" | "AUTHORITY_REQUIRED" };

export function approveAdjustment(variance: Variance, ctx: AdjustmentCtx): AdjustmentResult {
  if (variance.within) return { ok: true };
  if (!ctx.reason) return { ok: false, code: "REASON_REQUIRED" };
  if (!ctx.authority) return { ok: false, code: "AUTHORITY_REQUIRED" };
  return { ok: true };
}