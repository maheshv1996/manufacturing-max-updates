import { test } from "node:test";
import assert from "node:assert/strict";
import {
  postJournalEntry,
  reverseJournalEntry,
  isBalanced,
  journalEntryToRupees,
  type JournalEntry,
  type JournalLine,
} from "../src/lib/finance/glPosting";

const makeEntry = (lines: JournalLine[]): JournalEntry => ({
  date: "2026-09-05",
  period: "2026-09",
  narration: "test entry",
  lines,
});

test("postJournalEntry: balanced entry succeeds", () => {
  const entry = makeEntry([
    { accountCode: "1010", side: "DEBIT", amount: 100_00 },
    { accountCode: "4010", side: "CREDIT", amount: 100_00 },
  ]);
  const r = postJournalEntry(entry);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.totalDebit, 100_00);
    assert.equal(r.totalCredit, 100_00);
  }
});

test("postJournalEntry: multi-line balanced entry", () => {
  const entry = makeEntry([
    { accountCode: "1010", side: "DEBIT", amount: 100_00 },
    { accountCode: "1040", side: "DEBIT", amount: 18_00 },
    { accountCode: "4010", side: "CREDIT", amount: 118_00 },
  ]);
  const r = postJournalEntry(entry);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.totalDebit, 118_00);
    assert.equal(r.totalCredit, 118_00);
  }
});

test("postJournalEntry: unbalanced entry fails (BALANCE_MISMATCH)", () => {
  const entry = makeEntry([
    { accountCode: "1010", side: "DEBIT", amount: 100_00 },
    { accountCode: "4010", side: "CREDIT", amount: 90_00 },
  ]);
  const r = postJournalEntry(entry);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "BALANCE_MISMATCH");
    assert.equal(r.totalDebit, 100_00);
    assert.equal(r.totalCredit, 90_00);
  }
});

test("postJournalEntry: empty lines fails", () => {
  const entry = makeEntry([]);
  const r = postJournalEntry(entry);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "BALANCE_MISMATCH");
});

test("reverseJournalEntry: mirrors signs and preserves accounts", () => {
  const original = makeEntry([
    { accountCode: "1010", side: "DEBIT", amount: 100_00, narration: "cash" },
    { accountCode: "4010", side: "CREDIT", amount: 100_00, narration: "sales" },
  ]);
  const reversed = reverseJournalEntry({ originalEntry: original, reason: "entry error" });
  assert.equal(reversed.lines.length, 2);
  assert.equal(reversed.lines[0].side, "CREDIT");
  assert.equal(reversed.lines[0].amount, 100_00);
  assert.equal(reversed.lines[1].side, "DEBIT");
  assert.equal(reversed.lines[1].amount, 100_00);
  assert.equal(reversed.narration, "Reversal of: test entry. Reason: entry error");
});

test("isBalanced: returns true for balanced entry", () => {
  const entry = makeEntry([
    { accountCode: "1010", side: "DEBIT", amount: 100_00 },
    { accountCode: "4010", side: "CREDIT", amount: 100_00 },
  ]);
  assert.equal(isBalanced(entry), true);
});

test("isBalanced: returns false for unbalanced entry", () => {
  const entry = makeEntry([
    { accountCode: "1010", side: "DEBIT", amount: 100_00 },
    { accountCode: "4010", side: "CREDIT", amount: 90_00 },
  ]);
  assert.equal(isBalanced(entry), false);
});

test("journalEntryToRupees: converts paise to rupees", () => {
  const entry = makeEntry([
    { accountCode: "1010", side: "DEBIT", amount: 100_00 },
    { accountCode: "4010", side: "CREDIT", amount: 100_00 },
  ]);
  const rupees = journalEntryToRupees(entry);
  assert.equal(rupees.lines[0].amount, 100);
  assert.equal(rupees.lines[1].amount, 100);
});
