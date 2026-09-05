/**
 * C5-1 PO state machine — approval ladder + receipt status.
 * Pure functions; no DB. The caller decides thresholds; the engine enforces the ladder law.
 */
export type PoApprovalStatus = "APPROVED" | "PENDING_MANAGER" | "PENDING_OWNER" | "REJECTED";
export type PoStatus = "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export type PoApprovalAction =
  | { action: "ESCALATE"; tier: "MANAGER" | "OWNER" }
  | { action: "APPROVE"; tier: "MANAGER" | "OWNER"; ownerStillRequired?: boolean }
  | { action: "REJECT"; reason?: string };

export type PoApprovalResult =
  | { ok: true; approvalStatus: PoApprovalStatus }
  | { ok: false; code: "ILLEGAL_TRANSITION" | "REASON_REQUIRED" };

export function advancePoApproval(current: PoApprovalStatus, action: PoApprovalAction): PoApprovalResult {
  if (current === "REJECTED") return { ok: false, code: "ILLEGAL_TRANSITION" };

  if (action.action === "REJECT") {
    if (!action.reason || action.reason.trim() === "") return { ok: false, code: "REASON_REQUIRED" };
    return { ok: true, approvalStatus: "REJECTED" };
  }

  if (action.action === "ESCALATE") {
    if (current !== "APPROVED") return { ok: false, code: "ILLEGAL_TRANSITION" };
    return { ok: true, approvalStatus: action.tier === "MANAGER" ? "PENDING_MANAGER" : "PENDING_OWNER" };
  }

  // APPROVE
  if (current === "APPROVED") return { ok: false, code: "ILLEGAL_TRANSITION" };
  if (current === "PENDING_MANAGER" && action.tier === "MANAGER") {
    return { ok: true, approvalStatus: action.ownerStillRequired ? "PENDING_OWNER" : "APPROVED" };
  }
  if (current === "PENDING_OWNER" && action.tier === "OWNER") {
    return { ok: true, approvalStatus: "APPROVED" };
  }
  return { ok: false, code: "ILLEGAL_TRANSITION" };
}

export type ReceiptResult =
  | { ok: true; nextStatus: PoStatus; newReceived: number }
  | { ok: false; code: "OVER_DELIVERY" | "QTY_INVALID" | "PO_CANCELLED" };

export function nextReceiptStatus(
  current: PoStatus,
  opts: { receivedQty: number; addQty: number; poQty: number; tolerancePct: number },
): ReceiptResult {
  if (current === "CANCELLED") return { ok: false, code: "PO_CANCELLED" };
  if (opts.addQty <= 0) return { ok: false, code: "QTY_INVALID" };

  const newReceived = opts.receivedQty + opts.addQty;
  const maxAllowed = opts.poQty * (1 + opts.tolerancePct / 100);
  if (newReceived > maxAllowed) return { ok: false, code: "OVER_DELIVERY" };

  const nextStatus: PoStatus = newReceived >= opts.poQty ? "RECEIVED" : "PARTIAL";
  return { ok: true, nextStatus, newReceived };
}

export function cancelPo(receivedQty: number): { ok: true } | { ok: false; code: "HAS_RECEIPTS" } {
  if (receivedQty > 0) return { ok: false, code: "HAS_RECEIPTS" };
  return { ok: true };
}