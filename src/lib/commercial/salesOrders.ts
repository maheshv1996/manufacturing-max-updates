/**
 * C6-1 — Sales order state machine (DEPTH_03 F6; schema SalesOrderStatus).
 * Pure functions; no DB. The caller decides thresholds; the engine enforces the ladder law.
 */

export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type SalesOrderAction =
  | { action: "CONFIRM" }
  | { action: "START_PROGRESS" }
  | { action: "COMPLETE" }
  | { action: "CANCEL" };

export type SalesOrderTransitionResult =
  | { ok: true; status: SalesOrderStatus }
  | { ok: false; code: "ILLEGAL_TRANSITION" | "TERMINAL_STATE"; message: string };

const illegal = (from: SalesOrderStatus, action: string): SalesOrderTransitionResult => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} a sales order in state ${from}`,
});

export function transitionSalesOrder(current: SalesOrderStatus, a: SalesOrderAction): SalesOrderTransitionResult {
  switch (a.action) {
    case "CONFIRM": {
      if (current !== "DRAFT") return illegal(current, "CONFIRM");
      return { ok: true, status: "CONFIRMED" };
    }
    case "START_PROGRESS": {
      if (current !== "CONFIRMED") return illegal(current, "START_PROGRESS");
      return { ok: true, status: "IN_PROGRESS" };
    }
    case "COMPLETE": {
      if (current === "COMPLETED") return { ok: false, code: "TERMINAL_STATE", message: "Sales order is already completed" };
      if (current === "CANCELLED") return illegal(current, "COMPLETE");
      if (current !== "IN_PROGRESS") return illegal(current, "COMPLETE");
      return { ok: true, status: "COMPLETED" };
    }
    case "CANCEL": {
      if (current === "COMPLETED") return illegal(current, "CANCEL");
      if (current === "CANCELLED") return { ok: false, code: "ILLEGAL_TRANSITION", message: `Cannot cancel a sales order already in state ${current}` };
      if (current !== "DRAFT" && current !== "CONFIRMED") return illegal(current, "CANCEL");
      return { ok: true, status: "CANCELLED" };
    }
  }
}

// ---------------------------------------------------------------------------
// Fulfillment status — pure aggregation
// ---------------------------------------------------------------------------

export interface SalesOrderLineFulfillment {
  orderedQty: number;
  dispatchedQty: number;
  invoicedQty: number;
}

export interface SalesOrderFulfillment {
  totalOrdered: number;
  totalDispatched: number;
  totalInvoiced: number;
  dispatchPct: number;
  invoicePct: number;
  status: "PENDING" | "PARTIAL" | "FULFILLED";
}

export function salesOrderFulfillmentStatus(lines: SalesOrderLineFulfillment[]): SalesOrderFulfillment {
  const totalOrdered = lines.reduce((s, l) => s + (Math.round(l.orderedQty) || 0), 0);
  const totalDispatched = lines.reduce((s, l) => s + (Math.round(l.dispatchedQty) || 0), 0);
  const totalInvoiced = lines.reduce((s, l) => s + (Math.round(l.invoicedQty) || 0), 0);
  const dispatchPct = totalOrdered > 0 ? (totalDispatched / totalOrdered) * 100 : 0;
  const invoicePct = totalOrdered > 0 ? (totalInvoiced / totalOrdered) * 100 : 0;
  let status: SalesOrderFulfillment["status"] = "PENDING";
  if (totalDispatched >= totalOrdered && totalOrdered > 0) status = "FULFILLED";
  else if (totalDispatched > 0 || totalInvoiced > 0) status = "PARTIAL";
  return { totalOrdered, totalDispatched, totalInvoiced, dispatchPct, invoicePct, status };
}

// ---------------------------------------------------------------------------
// Numbering — SO-YYYY-NNNN
// ---------------------------------------------------------------------------

export function nextSalesOrderNumber(date: Date = new Date()): string {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  return `SO-${year}-${String(1).padStart(4, "0")}`;
}
