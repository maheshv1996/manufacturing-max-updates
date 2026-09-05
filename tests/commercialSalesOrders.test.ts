import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transitionSalesOrder,
  salesOrderFulfillmentStatus,
  nextSalesOrderNumber,
  type SalesOrderStatus,
  type SalesOrderAction,
} from "../src/lib/commercial/salesOrders";

const transitions: Array<{ from: SalesOrderStatus; to: SalesOrderStatus; action: SalesOrderAction }> = [
  { from: "DRAFT", to: "CONFIRMED", action: { action: "CONFIRM" } },
  { from: "CONFIRMED", to: "IN_PROGRESS", action: { action: "START_PROGRESS" } },
  { from: "IN_PROGRESS", to: "COMPLETED", action: { action: "COMPLETE" } },
  { from: "DRAFT", to: "CANCELLED", action: { action: "CANCEL" } },
  { from: "CONFIRMED", to: "CANCELLED", action: { action: "CANCEL" } },
];

for (const t of transitions) {
  test(`${t.from} -> ${t.action.action} -> ${t.to}`, () => {
    const r = transitionSalesOrder(t.from, t.action);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.status, t.to);
  });
}

const illegalCases: Array<{ from: SalesOrderStatus; action: SalesOrderAction; expectCode: string }> = [
  { from: "DRAFT", action: { action: "START_PROGRESS" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "DRAFT", action: { action: "COMPLETE" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "CONFIRMED", action: { action: "CONFIRM" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "CONFIRMED", action: { action: "COMPLETE" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "IN_PROGRESS", action: { action: "CONFIRM" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "IN_PROGRESS", action: { action: "START_PROGRESS" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "IN_PROGRESS", action: { action: "CANCEL" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "COMPLETED", action: { action: "CONFIRM" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "COMPLETED", action: { action: "START_PROGRESS" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "COMPLETED", action: { action: "COMPLETE" }, expectCode: "TERMINAL_STATE" },
  { from: "COMPLETED", action: { action: "CANCEL" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "CANCELLED", action: { action: "CONFIRM" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "CANCELLED", action: { action: "START_PROGRESS" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "CANCELLED", action: { action: "COMPLETE" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "CANCELLED", action: { action: "CANCEL" }, expectCode: "ILLEGAL_TRANSITION" },
];

for (const c of illegalCases) {
  test(`${c.from} + ${c.action.action} blocked (${c.expectCode})`, () => {
    const r = transitionSalesOrder(c.from, c.action);
    assert.equal(r.ok, false, `expected block for ${c.from} -> ${c.action.action}`);
    if (!r.ok) assert.equal(r.code, c.expectCode);
  });
}

test("COMPLETED is terminal (CANCEL blocked)", () => {
  const r = transitionSalesOrder("COMPLETED", { action: "CANCEL" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION");
});

test("salesOrderFulfillmentStatus: empty lines", () => {
  const f = salesOrderFulfillmentStatus([]);
  assert.equal(f.totalOrdered, 0);
  assert.equal(f.totalDispatched, 0);
  assert.equal(f.totalInvoiced, 0);
  assert.equal(f.status, "PENDING");
});

test("salesOrderFulfillmentStatus: partial dispatch", () => {
  const f = salesOrderFulfillmentStatus([
    { orderedQty: 100, dispatchedQty: 40, invoicedQty: 0 },
    { orderedQty: 50, dispatchedQty: 0, invoicedQty: 0 },
  ]);
  assert.equal(f.totalOrdered, 150);
  assert.equal(f.totalDispatched, 40);
  assert.equal(f.dispatchPct, 26.666666666666668);
  assert.equal(f.status, "PARTIAL");
});

test("salesOrderFulfillmentStatus: fully fulfilled", () => {
  const f = salesOrderFulfillmentStatus([
    { orderedQty: 100, dispatchedQty: 100, invoicedQty: 100 },
  ]);
  assert.equal(f.totalDispatched, 100);
  assert.equal(f.totalInvoiced, 100);
  assert.equal(f.dispatchPct, 100);
  assert.equal(f.invoicePct, 100);
  assert.equal(f.status, "FULFILLED");
});

test("nextSalesOrderNumber format", () => {
  const n = nextSalesOrderNumber(new Date("2026-09-05"));
  assert.equal(n, "SO-2026-0001");
});
