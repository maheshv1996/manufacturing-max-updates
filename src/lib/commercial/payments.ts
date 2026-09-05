/**
 * C6-2 — Payment state machine (DEPTH_03 F6; schema PaymentStatus).
 * Pure functions; no DB.
 */

export type PaymentStatus = "PENDING" | "CLEARED" | "BOUNCED";

export type PaymentAction =
  | { action: "CLEAR"; clearedAt: Date }
  | { action: "BOUNCE"; reason: string };

export type PaymentTransitionResult =
  | { ok: true; status: PaymentStatus }
  | { ok: false; code: "ILLEGAL_TRANSITION" | "REASON_REQUIRED" | "TERMINAL_STATE"; message: string };

const illegal = (from: PaymentStatus, action: string): PaymentTransitionResult => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} a payment in state ${from}`,
});

export function transitionPayment(current: PaymentStatus, a: PaymentAction): PaymentTransitionResult {
  switch (a.action) {
    case "CLEAR": {
      if (current === "CLEARED") return { ok: false, code: "TERMINAL_STATE", message: "Payment is already cleared" };
      if (current === "BOUNCED") return illegal(current, "CLEAR");
      if (current !== "PENDING") return illegal(current, "CLEAR");
      return { ok: true, status: "CLEARED" };
    }
    case "BOUNCE": {
      if (current === "BOUNCED") return { ok: false, code: "ILLEGAL_TRANSITION", message: "Payment is already bounced" };
      if (current === "CLEARED") return illegal(current, "BOUNCE");
      if (current === "PENDING" && (!a.reason || !a.reason.trim())) {
        return { ok: false, code: "REASON_REQUIRED", message: "Bounce reason is required" };
      }
      return { ok: true, status: "BOUNCED" };
    }
  }
}

// ---------------------------------------------------------------------------
// Payment record linkage — pure validation
// ---------------------------------------------------------------------------

export interface PaymentRecordInput {
  paymentId: string;
  invoiceId: string;
  amount: number; // paise
}

export interface PaymentRecordValidation {
  ok: boolean;
  code?: "MISSING_PAYMENT_ID" | "MISSING_INVOICE_ID" | "INVALID_AMOUNT";
  message?: string;
}

export function validatePaymentRecord(input: PaymentRecordInput): PaymentRecordValidation {
  if (!input.paymentId || !input.paymentId.trim()) {
    return { ok: false, code: "MISSING_PAYMENT_ID", message: "paymentId is required" };
  }
  if (!input.invoiceId || !input.invoiceId.trim()) {
    return { ok: false, code: "MISSING_INVOICE_ID", message: "invoiceId is required" };
  }
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "amount must be a positive integer (paise)" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Numbering — PMT-YYYY-NNN
// ---------------------------------------------------------------------------

export function nextPaymentNumber(date: Date = new Date()): string {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  return `PMT-${year}-${String(1).padStart(3, "0")}`;
}
