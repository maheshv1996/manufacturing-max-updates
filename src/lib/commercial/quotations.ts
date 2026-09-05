/**
 * C6-1 — Quotation state machine (DEPTH_03 F6; schema QuotationStatus).
 * Pure functions; no DB. The caller decides business rules; the engine enforces the state graph.
 */

export type QuotationStatus = "DRAFT" | "SENT" | "WON" | "LOST" | "CONVERTED";

export type QuotationAction =
  | { action: "SEND" }
  | { action: "MARK_WON" }
  | { action: "MARK_LOST" }
  | { action: "CONVERT" };

export type QuotationTransitionResult =
  | { ok: true; status: QuotationStatus }
  | { ok: false; code: "ILLEGAL_TRANSITION" | "ALREADY_CONVERTED" | "TERMINAL_STATE"; message: string };

const illegal = (from: QuotationStatus, action: string): QuotationTransitionResult => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} a quotation in state ${from}`,
});

export function transitionQuotation(current: QuotationStatus, a: QuotationAction): QuotationTransitionResult {
  switch (a.action) {
    case "SEND": {
      if (current !== "DRAFT") return illegal(current, "SEND");
      return { ok: true, status: "SENT" };
    }
    case "MARK_WON": {
      if (current === "CONVERTED") return { ok: false, code: "ALREADY_CONVERTED", message: "Cannot mark WON: quotation is already converted" };
      if (current === "WON") return { ok: false, code: "ILLEGAL_TRANSITION", message: `Cannot mark WON a quotation already in state ${current}` };
      if (current === "LOST") return illegal(current, "MARK_WON");
      if (current === "DRAFT") return illegal(current, "MARK_WON");
      return { ok: true, status: "WON" };
    }
    case "MARK_LOST": {
      if (current === "CONVERTED") return { ok: false, code: "ALREADY_CONVERTED", message: "Cannot mark LOST: quotation is already converted" };
      if (current === "LOST") return { ok: false, code: "ILLEGAL_TRANSITION", message: `Cannot mark LOST a quotation already in state ${current}` };
      if (current === "WON") return illegal(current, "MARK_LOST");
      if (current === "DRAFT") return illegal(current, "MARK_LOST");
      return { ok: true, status: "LOST" };
    }
    case "CONVERT": {
      if (current === "CONVERTED") return { ok: false, code: "ALREADY_CONVERTED", message: "Quotation is already converted" };
      if (current === "LOST") return illegal(current, "CONVERT");
      if (current === "DRAFT") return illegal(current, "CONVERT");
      return { ok: true, status: "CONVERTED" };
    }
  }
}

// ---------------------------------------------------------------------------
// Margin computation — pure, paise-safe
// ---------------------------------------------------------------------------

export interface QuoteLine {
  subtotal: number; // paise
  costAmount?: number; // paise, optional
}

export interface QuoteMargin {
  totalAmount: number; // paise
  costAmount: number; // paise
  margin: number; // paise
  marginPct: number; // 0–100
}

export function computeQuoteMargin(lines: QuoteLine[]): QuoteMargin {
  const totalAmount = lines.reduce((s, l) => s + (Math.round(l.subtotal) || 0), 0);
  const costAmount = lines.reduce((s, l) => s + (Math.round(l.costAmount ?? 0) || 0), 0);
  const margin = totalAmount - costAmount;
  const marginPct = totalAmount > 0 ? (margin / totalAmount) * 100 : 0;
  return { totalAmount, costAmount, margin, marginPct };
}

// ---------------------------------------------------------------------------
// Numbering — QT-YYYY-NNN
// ---------------------------------------------------------------------------

export function nextQuotationNumber(date: Date = new Date()): string {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  return `QT-${year}-${String(1).padStart(3, "0")}`;
}
