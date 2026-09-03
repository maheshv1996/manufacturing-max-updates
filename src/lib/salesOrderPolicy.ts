/**
 * Sales-order fulfilment policy — pure, DB-free decision logic shared by the
 * billing route and its regression tests (no imports → safe under Node's
 * type-stripped test runner).
 *
 * Regression it guards: two fully-billed demo orders stayed CONFIRMED /
 * PARTIALLY_DISPATCHED forever and Bill 400'd with NOTHING_TO_BILL — the
 * order book could not heal itself. A fully-invoiced order in a healable
 * state now reads INVOICED instead.
 */

/** Status ladder positions that mean "fulfilment may still complete". */
export const HEALABLE_TO_INVOICED = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "PARTIALLY_DISPATCHED",
  "DISPATCHED",
] as const;

export interface SalesOrderLineQty {
  quantity: number | string;
  invoicedQty?: number | string | null;
}

export interface SalesOrderFulfilment {
  /** Every line has invoicedQty >= quantity (within a paise-of-a-piece epsilon). */
  allInvoiced: boolean;
  /** Count of lines still carrying open (unbilled) quantity. */
  openLineCount: number;
  /** True when allInvoiced and the status can legitimately become INVOICED. */
  healableToInvoiced: boolean;
}

/** Pure fulfilment check (see module doc — mirrors the /api/invoices heal). */
export function computeSalesOrderFulfilment(
  status: string | null | undefined,
  lines: SalesOrderLineQty[],
): SalesOrderFulfilment {
  const list = Array.isArray(lines) ? lines : [];
  const allInvoiced =
    list.length > 0 &&
    list.every((l) => Number(l.invoicedQty || 0) >= Number(l.quantity) - 0.001);
  const openLineCount = list.filter(
    (l) => Number(l.quantity) - Number(l.invoicedQty || 0) > 0.001,
  ).length;
  return {
    allInvoiced,
    openLineCount,
    healableToInvoiced:
      allInvoiced &&
      (HEALABLE_TO_INVOICED as readonly string[]).includes(String(status || "")),
  };
}
