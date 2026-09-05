import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReceipt, stockAfterTx } from "../src/lib/supply/receipt";

const base = { poStatus: "ORDERED" as const, receivedQty: 0, poQty: 100, tolerancePct: 0, certsRequired: false, certsLinked: 0 };

test("full receipt: ORDERED -> RECEIVED, newReceived = 100", () => {
  const r = applyReceipt({ ...base, addQty: 100 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.nextStatus, "RECEIVED");
  assert.equal(r.newReceived, 100);
});

test("partial receipt -> PARTIAL", () => {
  const r = applyReceipt({ ...base, addQty: 40 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.nextStatus, "PARTIAL");
  assert.equal(r.newReceived, 40);
});

test("cert missing blocks IN for tracked material (CERT_REQUIRED)", () => {
  const r = applyReceipt({ ...base, addQty: 40, certsRequired: true, certsLinked: 0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "CERT_REQUIRED");
});

test("cert present passes; cert count below qty still blocks", () => {
  const ok = applyReceipt({ ...base, addQty: 40, certsRequired: true, certsLinked: 50 });
  assert.equal(ok.ok, true);
  const short = applyReceipt({ ...base, addQty: 40, certsRequired: true, certsLinked: 30 });
  assert.equal(short.ok, false);
  if (!short.ok) assert.equal(short.code, "CERT_REQUIRED");
});

test("over-delivery within tolerance allowed", () => {
  const r = applyReceipt({ ...base, receivedQty: 95, addQty: 10, tolerancePct: 10 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.newReceived, 105);
});

test("over-delivery beyond tolerance blocked (OVER_DELIVERY)", () => {
  const r = applyReceipt({ ...base, receivedQty: 95, addQty: 16, tolerancePct: 10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "OVER_DELIVERY");
});

test("already-received guard: received >= poQty blocks a second shipment", () => {
  const r = applyReceipt({ ...base, receivedQty: 100, addQty: 1, tolerancePct: 10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ALREADY_RECEIVED");
});

test("receipt on CANCELLED PO is illegal (PO_CANCELLED)", () => {
  const r = applyReceipt({ ...base, poStatus: "CANCELLED", addQty: 1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "PO_CANCELLED");
});

test("stock: IN adds, OUT subtracts", () => {
  const in1 = stockAfterTx(10, { type: "IN", qty: 5 });
  assert.equal(in1.ok, true);
  if (in1.ok) assert.equal(in1.balance, 15);
  const out = stockAfterTx(15, { type: "OUT", qty: 6 });
  assert.equal(out.ok, true);
  if (out.ok) assert.equal(out.balance, 9);
});

test("stock: OUT beyond balance is blocked (NEGATIVE_STOCK)", () => {
  const r = stockAfterTx(10, { type: "OUT", qty: 11 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NEGATIVE_STOCK");
});

test("stock: ADJUST without reason blocked (ADJUST_REASON_REQUIRED)", () => {
  const r = stockAfterTx(10, { type: "ADJUST", qty: -2 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ADJUST_REASON_REQUIRED");
  const ok = stockAfterTx(10, { type: "ADJUST", qty: -2, reason: "cycle count" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.balance, 8);
});

test("stock: negative qty is invalid (QTY_INVALID)", () => {
  const r = stockAfterTx(10, { type: "IN", qty: -1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "QTY_INVALID");
});