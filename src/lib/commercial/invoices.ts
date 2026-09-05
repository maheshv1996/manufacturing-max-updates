/**
 * C6-2 — Invoice state machine + paise-safe totals (DEPTH_03 F6; schema InvoiceStatus).
 * Pure functions; no DB.
 */

import { toPaise, fromPaise } from "../money";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "PARTIAL" | "OVERDUE";

export type InvoiceAction =
  | { action: "SEND" }
  | { action: "MARK_PAID" }
  | { action: "MARK_PARTIAL"; amount: number }
  | { action: "APPLY_PAYMENT"; amount: number }
  | { action: "MARK_OVERDUE" };

export type InvoiceTransitionResult =
  | { ok: true; status: InvoiceStatus; remainingBalance: number }
  | { ok: false; code: "ILLEGAL_TRANSITION" | "TERMINAL_STATE" | "INVALID_AMOUNT" | "OVERPAYMENT"; message: string };

const illegal = (from: InvoiceStatus, action: string): InvoiceTransitionResult => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} an invoice in state ${from}`,
});

export function transitionInvoice(
  current: InvoiceStatus,
  totalValue: number,
  paidAmount: number,
  a: InvoiceAction,
): InvoiceTransitionResult {
  const remaining = totalValue - paidAmount;

  switch (a.action) {
    case "SEND": {
      if (current !== "DRAFT") return illegal(current, "SEND");
      return { ok: true, status: "SENT", remainingBalance: remaining };
    }
    case "MARK_PAID": {
      if (current === "PAID") return { ok: false, code: "TERMINAL_STATE", message: "Invoice is already paid" };
      if (current === "DRAFT") return illegal(current, "MARK_PAID");
      return { ok: true, status: "PAID", remainingBalance: 0 };
    }
    case "MARK_PARTIAL":
    case "APPLY_PAYMENT": {
      const amount = Math.round(a.amount);
      if (amount <= 0) return { ok: false, code: "INVALID_AMOUNT", message: "Payment amount must be positive" };
      if (amount > remaining) return { ok: false, code: "OVERPAYMENT", message: `Payment ${fromPaise(amount)} exceeds remaining ${fromPaise(remaining)}` };
      const newPaid = paidAmount + amount;
      const newRemaining = totalValue - newPaid;
      const nextStatus: InvoiceStatus = newRemaining <= 0 ? "PAID" : "PARTIAL";
      return { ok: true, status: nextStatus, remainingBalance: Math.max(0, newRemaining) };
    }
    case "MARK_OVERDUE": {
      if (current === "PAID") return illegal(current, "MARK_OVERDUE");
      if (current === "OVERDUE") return { ok: false, code: "ILLEGAL_TRANSITION", message: "Invoice is already marked overdue" };
      if (current === "DRAFT") return illegal(current, "MARK_OVERDUE");
      return { ok: true, status: "OVERDUE", remainingBalance: remaining };
    }
  }
}

// ---------------------------------------------------------------------------
// Invoice line totals — paise-safe GST split
// ---------------------------------------------------------------------------

export interface InvoiceLineInput {
  taxableValue: number; // paise
  cgstPct: number; // 0–100
  sgstPct: number; // 0–100
  igstPct: number; // 0–100
}

export interface InvoiceLineTotals {
  taxableValue: number; // paise
  cgstAmt: number; // paise
  sgstAmt: number; // paise
  igstAmt: number; // paise
  totalValue: number; // paise
}

export function computeInvoiceLineTotals(line: InvoiceLineInput): InvoiceLineTotals {
  const taxableValue = Math.round(line.taxableValue);
  const cgstPct = Math.min(100, Math.max(0, line.cgstPct));
  const sgstPct = Math.min(100, Math.max(0, line.sgstPct));
  const igstPct = Math.min(100, Math.max(0, line.igstPct));

  const cgstAmt = Math.round((taxableValue * cgstPct) / 100);
  const sgstAmt = Math.round((taxableValue * sgstPct) / 100);
  const igstAmt = Math.round((taxableValue * igstPct) / 100);
  const totalValue = taxableValue + cgstAmt + sgstAmt + igstAmt;

  return { taxableValue, cgstAmt, sgstAmt, igstAmt, totalValue };
}

export function computeInvoiceTotals(lines: InvoiceLineInput[]): InvoiceLineTotals {
  const totals = lines.map(computeInvoiceLineTotals);
  return totals.reduce(
    (acc, t) => ({
      taxableValue: acc.taxableValue + t.taxableValue,
      cgstAmt: acc.cgstAmt + t.cgstAmt,
      sgstAmt: acc.sgstAmt + t.sgstAmt,
      igstAmt: acc.igstAmt + t.igstAmt,
      totalValue: acc.totalValue + t.totalValue,
    }),
    { taxableValue: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalValue: 0 },
  );
}

// ---------------------------------------------------------------------------
// Numbering — INV-YYYY-NNN
// ---------------------------------------------------------------------------

export function nextInvoiceNumber(date: Date = new Date()): string {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  return `INV-${year}-${String(1).padStart(3, "0")}`;
}
