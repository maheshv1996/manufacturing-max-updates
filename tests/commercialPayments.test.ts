import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transitionPayment,
  validatePaymentRecord,
  nextPaymentNumber,
  type PaymentStatus,
  type PaymentAction,
} from "../src/lib/commercial/payments";

const transitions: Array<{ from: PaymentStatus; to: PaymentStatus; action: PaymentAction }> = [
  { from: "PENDING", to: "CLEARED", action: { action: "CLEAR", clearedAt: new Date("2026-09-05") } },
  { from: "PENDING", to: "BOUNCED", action: { action: "BOUNCE", reason: "insufficient funds" } },
];

for (const t of transitions) {
  test(`${t.from} -> ${t.action.action} -> ${t.to}`, () => {
    const r = transitionPayment(t.from, t.action);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.status, t.to);
  });
}

const illegalCases: Array<{ from: PaymentStatus; action: PaymentAction; expectCode: string }> = [
  { from: "CLEARED", action: { action: "CLEAR", clearedAt: new Date() }, expectCode: "TERMINAL_STATE" },
  { from: "CLEARED", action: { action: "BOUNCE", reason: "test" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "BOUNCED", action: { action: "CLEAR", clearedAt: new Date() }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "BOUNCED", action: { action: "BOUNCE", reason: "test" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "PENDING", action: { action: "BOUNCE", reason: "" }, expectCode: "REASON_REQUIRED" },
];

for (const c of illegalCases) {
  test(`${c.from} + ${c.action.action} blocked (${c.expectCode})`, () => {
    const r = transitionPayment(c.from, c.action);
    assert.equal(r.ok, false, `expected block for ${c.from} -> ${c.action.action}`);
    if (!r.ok) assert.equal(r.code, c.expectCode);
  });
}

test("validatePaymentRecord: valid input", () => {
  const r = validatePaymentRecord({ paymentId: "pmt-1", invoiceId: "inv-1", amount: 100_00 });
  assert.equal(r.ok, true);
});

test("validatePaymentRecord: missing paymentId", () => {
  const r = validatePaymentRecord({ paymentId: "", invoiceId: "inv-1", amount: 100_00 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "MISSING_PAYMENT_ID");
});

test("validatePaymentRecord: missing invoiceId", () => {
  const r = validatePaymentRecord({ paymentId: "pmt-1", invoiceId: "", amount: 100_00 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "MISSING_INVOICE_ID");
});

test("validatePaymentRecord: invalid amount", () => {
  const r = validatePaymentRecord({ paymentId: "pmt-1", invoiceId: "inv-1", amount: -10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "INVALID_AMOUNT");
});

test("nextPaymentNumber format", () => {
  const n = nextPaymentNumber(new Date("2026-09-05"));
  assert.equal(n, "PMT-2026-001");
});
