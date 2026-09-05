import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transitionQuotation,
  computeQuoteMargin,
  nextQuotationNumber,
  type QuotationStatus,
  type QuotationAction,
} from "../src/lib/commercial/quotations";

const transitions: Array<{ from: QuotationStatus; to: QuotationStatus; action: QuotationAction }> = [
  { from: "DRAFT", to: "SENT", action: { action: "SEND" } },
  { from: "SENT", to: "WON", action: { action: "MARK_WON" } },
  { from: "SENT", to: "LOST", action: { action: "MARK_LOST" } },
  { from: "SENT", to: "CONVERTED", action: { action: "CONVERT" } },
  { from: "WON", to: "CONVERTED", action: { action: "CONVERT" } },
];

for (const t of transitions) {
  test(`${t.from} -> ${t.action.action} -> ${t.to}`, () => {
    const r = transitionQuotation(t.from, t.action);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.status, t.to);
  });
}

const illegalCases: Array<{ from: QuotationStatus; action: QuotationAction; expectCode: string }> = [
  { from: "DRAFT", action: { action: "MARK_WON" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "DRAFT", action: { action: "MARK_LOST" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "DRAFT", action: { action: "CONVERT" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "WON", action: { action: "MARK_WON" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "WON", action: { action: "MARK_LOST" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "LOST", action: { action: "MARK_WON" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "LOST", action: { action: "CONVERT" }, expectCode: "ILLEGAL_TRANSITION" },
  { from: "CONVERTED", action: { action: "MARK_WON" }, expectCode: "ALREADY_CONVERTED" },
  { from: "CONVERTED", action: { action: "MARK_LOST" }, expectCode: "ALREADY_CONVERTED" },
  { from: "CONVERTED", action: { action: "CONVERT" }, expectCode: "ALREADY_CONVERTED" },
  { from: "SENT", action: { action: "SEND" }, expectCode: "ILLEGAL_TRANSITION" },
];

for (const c of illegalCases) {
  test(`${c.from} + ${c.action.action} blocked (${c.expectCode})`, () => {
    const r = transitionQuotation(c.from, c.action);
    assert.equal(r.ok, false, `expected block for ${c.from} -> ${c.action.action}`);
    if (!r.ok) assert.equal(r.code, c.expectCode);
  });
}

test("CONVERTED is terminal (SEND blocked)", () => {
  const r = transitionQuotation("CONVERTED", { action: "SEND" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION");
});

test("computeQuoteMargin: totals + margin + pct", () => {
  const lines = [
    { subtotal: 100_00, costAmount: 60_00 },
    { subtotal: 200_00, costAmount: 120_00 },
  ];
  const m = computeQuoteMargin(lines);
  assert.equal(m.totalAmount, 300_00);
  assert.equal(m.costAmount, 180_00);
  assert.equal(m.margin, 120_00);
  assert.equal(m.marginPct, 40);
});

test("computeQuoteMargin: zero lines", () => {
  const m = computeQuoteMargin([]);
  assert.equal(m.totalAmount, 0);
  assert.equal(m.costAmount, 0);
  assert.equal(m.margin, 0);
  assert.equal(m.marginPct, 0);
});

test("nextQuotationNumber format", () => {
  const n = nextQuotationNumber(new Date("2026-09-05"));
  assert.equal(n, "QT-2026-001");
});
