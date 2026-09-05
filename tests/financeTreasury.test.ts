import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileBank, nextChequeNumber, type BankStatementEntry, type BookEntry } from "../src/lib/finance/treasury";

test("reconcileBank: exact match on amount and date", () => {
  const statement: BankStatementEntry[] = [
    { date: "2026-09-01", description: "Payment from Customer A", amount: 100_00 },
    { date: "2026-09-02", description: "Bank charges", amount: -500 },
  ];
  const book: BookEntry[] = [
    { date: "2026-09-01", description: "Customer A", amount: 100_00 },
    { date: "2026-09-02", description: "Bank charges", amount: -500 },
  ];
  const r = reconcileBank(statement, book, 0);
  assert.equal(r.matched.length, 2);
  assert.equal(r.unmatchedStatement.length, 0);
  assert.equal(r.unmatchedBook.length, 0);
});

test("reconcileBank: unmatched items", () => {
  const statement: BankStatementEntry[] = [
    { date: "2026-09-01", description: "Payment from Customer A", amount: 100_00 },
    { date: "2026-09-03", description: "Interest credited", amount: 200 },
  ];
  const book: BookEntry[] = [
    { date: "2026-09-01", description: "Customer A", amount: 100_00 },
  ];
  const r = reconcileBank(statement, book, 0);
  assert.equal(r.matched.length, 1);
  assert.equal(r.unmatchedStatement.length, 1);
  assert.equal(r.unmatchedBook.length, 0);
  assert.equal(r.unmatchedStatement[0].description, "Interest credited");
});

test("reconcileBank: tolerance allows near-match", () => {
  const statement: BankStatementEntry[] = [
    { date: "2026-09-01", description: "Payment", amount: 100_00 },
  ];
  const book: BookEntry[] = [
    { date: "2026-09-01", description: "Payment", amount: 100_50 },
  ];
  const r = reconcileBank(statement, book, 100);
  assert.equal(r.matched.length, 1);
  assert.equal(r.unmatchedStatement.length, 0);
});

test("reconcileBank: multiple book entries match first statement", () => {
  const statement: BankStatementEntry[] = [
    { date: "2026-09-01", description: "Payment", amount: 100_00 },
  ];
  const book: BookEntry[] = [
    { date: "2026-09-01", description: "Payment", amount: 100_00 },
    { date: "2026-09-01", description: "Other", amount: 50_00 },
  ];
  const r = reconcileBank(statement, book, 0);
  assert.equal(r.matched.length, 1);
  assert.equal(r.unmatchedStatement.length, 0);
  assert.equal(r.unmatchedBook.length, 1);
});

test("nextChequeNumber format", () => {
  const n = nextChequeNumber(new Date("2026-09-05"));
  assert.equal(n, "CHQ-2026-001");
});
