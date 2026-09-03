/**
 * Sales-order fulfilment regression tests.
 *
 * Regression: two fully-billed demo orders stayed CONFIRMED /
 * PARTIALLY_DISPATCHED forever and the Bill action 400'd with NOTHING_TO_BILL —
 * the order book could not heal itself. computeSalesOrderFulfilment is the
 * pure decision behind the /api/invoices self-heal; these tests pin it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeSalesOrderFulfilment,
  HEALABLE_TO_INVOICED,
} from "../src/lib/salesOrderPolicy.ts";

const full = (qty: number) => ({ quantity: qty, invoicedQty: qty });
const partial = (qty: number, billed: number) => ({
  quantity: qty,
  invoicedQty: billed,
});

describe("computeSalesOrderFulfilment", () => {
  test("all lines fully invoiced → allInvoiced + healable for CONFIRMED", () => {
    const r = computeSalesOrderFulfilment("CONFIRMED", [full(12), full(3)]);
    assert.equal(r.allInvoiced, true);
    assert.equal(r.openLineCount, 0);
    assert.equal(r.healableToInvoiced, true);
  });

  test("every healable status flips; terminal/INVOICED do not", () => {
    for (const status of HEALABLE_TO_INVOICED) {
      assert.equal(computeSalesOrderFulfilment(status, [full(1)]).healableToInvoiced, true, status);
    }
    assert.equal(computeSalesOrderFulfilment("INVOICED", [full(1)]).healableToInvoiced, false);
    assert.equal(computeSalesOrderFulfilment("DRAFT", [full(1)]).healableToInvoiced, false);
    assert.equal(computeSalesOrderFulfilment("CANCELLED", [full(1)]).healableToInvoiced, false);
    assert.equal(computeSalesOrderFulfilment(undefined, [full(1)]).healableToInvoiced, false);
  });

  test("open lines are never healed — NOTHING_TO_BILL territory", () => {
    const r = computeSalesOrderFulfilment("CONFIRMED", [full(10), partial(10, 7)]);
    assert.equal(r.allInvoiced, false);
    assert.equal(r.openLineCount, 1);
    assert.equal(r.healableToInvoiced, false);
  });

  test("empty order (no lines) is not treated as fully invoiced", () => {
    const r = computeSalesOrderFulfilment("CONFIRMED", []);
    assert.equal(r.allInvoiced, false);
    assert.equal(r.openLineCount, 0);
    assert.equal(r.healableToInvoiced, false);
  });

  test("string quantities and float dust within tolerance behave", () => {
    // invoicedQty 11.999 vs quantity 12 (float artifact) still counts as full.
    const r = computeSalesOrderFulfilment("PARTIALLY_DISPATCHED", [
      { quantity: "12", invoicedQty: 11.999 },
    ]);
    assert.equal(r.allInvoiced, true);
    assert.equal(r.healableToInvoiced, true);
  });

  test("invoiced overshoot is still 'all invoiced' (never negative open)", () => {
    const r = computeSalesOrderFulfilment("DISPATCHED", [partial(10, 12)]);
    assert.equal(r.allInvoiced, true);
    assert.equal(r.openLineCount, 0);
  });
});
