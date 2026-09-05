/**
 * C5-2 Receipt + cert + stock gate.
 * Pure functions. `applyReceipt` composes the double-receipt guard, the cert
 * gate (W3: no uncerted material into usable stock when tracked), and the
 * C5-1 tolerance math. `stockAfterTx` forbids silent negative stock.
 */
import { nextReceiptStatus, type PoStatus } from "./po";

export type ReceiptGate =
  | { ok: true; nextStatus: PoStatus; newReceived: number }
  | { ok: false; code: "OVER_DELIVERY" | "CERT_REQUIRED" | "ALREADY_RECEIVED" | "QTY_INVALID" | "PO_CANCELLED" };

export function applyReceipt(opts: {
  poStatus: PoStatus;
  receivedQty: number;
  addQty: number;
  poQty: number;
  tolerancePct: number;
  certsRequired: boolean;
  certsLinked: number;
}): ReceiptGate {
  if (opts.poStatus === "CANCELLED") return { ok: false, code: "PO_CANCELLED" };
  if (opts.addQty <= 0) return { ok: false, code: "QTY_INVALID" };
  // Double-receipt guard: once the PO qty is met, no further shipments.
  if (opts.receivedQty >= opts.poQty) return { ok: false, code: "ALREADY_RECEIVED" };
  // W3 cert gate: tracked material enters stock only with a linked cert per unit.
  if (opts.certsRequired && opts.certsLinked < opts.addQty) return { ok: false, code: "CERT_REQUIRED" };
  return nextReceiptStatus(opts.poStatus, {
    receivedQty: opts.receivedQty,
    addQty: opts.addQty,
    poQty: opts.poQty,
    tolerancePct: opts.tolerancePct,
  });
}

export type StockOp = { type: "IN" | "OUT" | "ADJUST"; qty: number; reason?: string };
export type StockResult =
  | { ok: true; balance: number }
  | { ok: false; code: "NEGATIVE_STOCK" | "ADJUST_REASON_REQUIRED" | "QTY_INVALID" };

export function stockAfterTx(balance: number, op: StockOp): StockResult {
  // Negative qty is meaningful only for ADJUST (a count-down correction).
  if (op.type !== "ADJUST" && op.qty < 0) return { ok: false, code: "QTY_INVALID" };
  if (op.type === "ADJUST" && !op.reason) return { ok: false, code: "ADJUST_REASON_REQUIRED" };
  const delta = op.type === "OUT" ? -op.qty : op.qty;
  const next = balance + delta;
  // No silent negatives: OUT beyond balance, or an ADJUST driving below zero.
  if (next < 0) return { ok: false, code: "NEGATIVE_STOCK" };
  return { ok: true, balance: next };
}