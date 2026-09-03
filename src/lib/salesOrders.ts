import { nextSequenceTx } from "./sequence";

/** Round to 2dp — project-wide money convention. */
export const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export interface SalesLineCompute {
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
}

export interface SalesLineTotals {
  amount: number; // qty × unitPrice
  discountAmt: number;
  taxAmt: number;
  total: number; // amount − discount + tax
}

/**
 * Per-line money math for quotation-driven sales documents:
 * amount = qty × price, discount off amount, GST on the discounted base.
 */
export function computeSalesLineTotals(l: SalesLineCompute): SalesLineTotals {
  const quantity = Math.abs(Number(l.quantity) || 0);
  const unitPrice = Math.abs(Number(l.unitPrice) || 0);
  const discountPct = Math.min(100, Math.max(0, Number(l.discountPct) || 0));
  const taxPct = Math.min(100, Math.max(0, Number(l.taxPct) || 0));

  const amount = round2(quantity * unitPrice);
  const discountAmt = round2((amount * discountPct) / 100);
  const taxable = round2(amount - discountAmt);
  const taxAmt = round2((taxable * taxPct) / 100);
  return { amount, discountAmt, taxAmt, total: round2(taxable + taxAmt) };
}

// Pure fulfilment/heal policy lives in ./salesOrderPolicy (DB-free, testable).
export {
  HEALABLE_TO_INVOICED,
  computeSalesOrderFulfilment,
} from "./salesOrderPolicy";
export type { SalesOrderLineQty, SalesOrderFulfilment } from "./salesOrderPolicy";

/** SO-YYYY-NNNN via the atomic SequenceCounter (inside a transaction). */
export async function nextSalesOrderNumber(
  tx: any,
  date: Date = new Date(),
): Promise<string> {
  return nextSequenceTx(tx, "SO", 4, date);
}
