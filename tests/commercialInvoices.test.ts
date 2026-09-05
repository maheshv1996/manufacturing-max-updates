import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transitionInvoice,
  computeInvoiceLineTotals,
  computeInvoiceTotals,
  nextInvoiceNumber,
  type InvoiceStatus,
  type InvoiceAction,
} from "../src/lib/commercial/invoices";

const invoiceTransitions: Array<{
  from: InvoiceStatus;
  totalValue: number;
  paidAmount: number;
  action: InvoiceAction;
  to: InvoiceStatus;
  remaining?: number;
}> = [
  { from: "DRAFT", totalValue: 100_00, paidAmount: 0, action: { action: "SEND" }, to: "SENT", remaining: 100_00 },
  { from: "SENT", totalValue: 100_00, paidAmount: 0, action: { action: "MARK_PAID" }, to: "PAID", remaining: 0 },
  { from: "SENT", totalValue: 100_00, paidAmount: 0, action: { action: "APPLY_PAYMENT", amount: 40_00 }, to: "PARTIAL", remaining: 60_00 },
  { from: "PARTIAL", totalValue: 100_00, paidAmount: 40_00, action: { action: "APPLY_PAYMENT", amount: 60_00 }, to: "PAID", remaining: 0 },
  { from: "SENT", totalValue: 100_00, paidAmount: 0, action: { action: "MARK_OVERDUE" }, to: "OVERDUE", remaining: 100_00 },
];

for (const t of invoiceTransitions) {
  test(`${t.from} + ${t.action.action} -> ${t.to}`, () => {
    const r = transitionInvoice(t.from, t.totalValue, t.paidAmount, t.action);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.status, t.to);
      if (t.remaining !== undefined) assert.equal(r.remainingBalance, t.remaining);
    }
  });
}

const illegalInvoiceCases: Array<{ from: InvoiceStatus; totalValue: number; paidAmount: number; action: InvoiceAction; expectCode: string }> = [
  { from: "DRAFT", totalValue: 100_00, paidAmount: 0, action: { action: "MARK_PAID" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "PAID", totalValue: 100_00, paidAmount: 100_00, action: { action: "MARK_PAID" }, expectCode: "TERMINAL_STATE" },
  { from: "PAID", totalValue: 100_00, paidAmount: 100_00, action: { action: "APPLY_PAYMENT", amount: 10_00 }, expectCode: "OVERPAYMENT" },
  { from: "SENT", totalValue: 100_00, paidAmount: 0, action: { action: "APPLY_PAYMENT", amount: -10_00 }, expectCode: "INVALID_AMOUNT" },
  { from: "DRAFT", totalValue: 100_00, paidAmount: 0, action: { action: "MARK_OVERDUE" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "PAID", totalValue: 100_00, paidAmount: 100_00, action: { action: "MARK_OVERDUE" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "OVERDUE", totalValue: 100_00, paidAmount: 0, action: { action: "MARK_OVERDUE" }, expectCode: "ILLEGAL_TRANSITION" },
];

for (const c of illegalInvoiceCases) {
  test(`${c.from} + ${c.action.action} blocked (${c.expectCode})`, () => {
    const r = transitionInvoice(c.from, c.totalValue, c.paidAmount, c.action);
    assert.equal(r.ok, false, `expected block for ${c.from} -> ${c.action.action}`);
    if (!r.ok) assert.equal(r.code, c.expectCode);
  });
}

test("computeInvoiceLineTotals: GST split paise", () => {
  const t = computeInvoiceLineTotals({ taxableValue: 100_00, cgstPct: 9, sgstPct: 9, igstPct: 0 });
  assert.equal(t.taxableValue, 100_00);
  assert.equal(t.cgstAmt, 9_00);
  assert.equal(t.sgstAmt, 9_00);
  assert.equal(t.igstAmt, 0);
  assert.equal(t.totalValue, 118_00);
});

test("computeInvoiceTotals: multi-line aggregate", () => {
  const t = computeInvoiceTotals([
    { taxableValue: 100_00, cgstPct: 9, sgstPct: 9, igstPct: 0 },
    { taxableValue: 50_00, cgstPct: 9, sgstPct: 9, igstPct: 0 },
  ]);
  assert.equal(t.taxableValue, 150_00);
  assert.equal(t.cgstAmt, 13_50);
  assert.equal(t.sgstAmt, 13_50);
  assert.equal(t.totalValue, 177_00);
});

test("nextInvoiceNumber format", () => {
  const n = nextInvoiceNumber(new Date("2026-09-05"));
  assert.equal(n, "INV-2026-001");
});
