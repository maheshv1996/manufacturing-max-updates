/**
 * GL engine regression tests — the pure, DB-free invariants that protect the
 * ledger: a valid unique chart of accounts, correct fiscal-period bucketing,
 * and the rupee mapping applied at every API boundary (ledger rows are stored
 * as integer paise; clients always see rupees).
 *
 * DB-backed paths (period gate, balance enforcement, reversal mirroring) are
 * exercised by the live smoke runs; the invariants below are what CI can hold
 * without a database.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COA,
  periodForDate,
  journalEntryToRupees,
} from "../src/lib/glCore.ts";

describe("DEFAULT_COA", () => {
  test("has a healthy account population with unique codes and names", () => {
    assert.ok(DEFAULT_COA.length >= 50, `expected >= 50 accounts, got ${DEFAULT_COA.length}`);
    const codes = new Set(DEFAULT_COA.map((a) => a.code));
    assert.equal(codes.size, DEFAULT_COA.length, "account codes must be unique");
    const names = new Set(DEFAULT_COA.map((a) => a.name.trim()));
    assert.equal(names.size, DEFAULT_COA.length, "account names must be unique");
  });

  test("covers every major category with both normal-balance sides", () => {
    const types = new Set(DEFAULT_COA.map((a) => a.type));
    for (const t of ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]) {
      assert.ok(types.has(t as never), `missing ${t} accounts`);
    }
    const balances = new Set(DEFAULT_COA.map((a) => a.normalBalance));
    assert.ok(balances.has("DEBIT") && balances.has("CREDIT"));
    // Assets/expenses debit; liabilities/equity/revenue credit (per group).
    // The one intentional exception: 1260 Accumulated Depreciation is a
    // contra-asset that carries a CREDIT normal balance.
    for (const a of DEFAULT_COA) {
      if (a.code === "1260") continue; // contra-asset, CREDIT-normal by design
      if (a.type === "ASSET" || a.type === "EXPENSE") {
        assert.equal(a.normalBalance, "DEBIT", `${a.code} ${a.name} should be DEBIT-normal`);
      } else {
        assert.equal(a.normalBalance, "CREDIT", `${a.code} ${a.name} should be CREDIT-normal`);
      }
    }
    const accDep = DEFAULT_COA.find((a) => a.code === "1260");
    assert.equal(accDep?.normalBalance, "CREDIT");
  });

  test("critical accounts exist with stable codes (journal flows depend on them)", () => {
    const byCode = new Map(DEFAULT_COA.map((a) => [a.code, a]));
    for (const code of ["1010", "1020", "1030", "1040", "2010", "2020", "4010", "5010"]) {
      assert.ok(byCode.has(code), `account ${code} missing`);
    }
  });
});

describe("periodForDate", () => {
  test("formats YYYY-MM with zero padding", () => {
    assert.equal(periodForDate(new Date(2026, 0, 15)), "2026-01");
    assert.equal(periodForDate(new Date(2026, 10, 5)), "2026-11");
    assert.equal(periodForDate(new Date(2026, 11, 31)), "2026-12");
  });

  test("rolls over the calendar year at December", () => {
    assert.equal(periodForDate(new Date(2026, 11, 31)), "2026-12");
    assert.equal(periodForDate(new Date(2027, 0, 1)), "2027-01");
  });

  test("an invalid date falls back to the current period instead of NaN", () => {
    const p = periodForDate(new Date(Number.NaN));
    const now = new Date();
    assert.equal(p, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  });
});

describe("journalEntryToRupees", () => {
  test("maps integer-paise rows back to the rupee API contract", () => {
    const out = journalEntryToRupees({
      id: "e1",
      totalDebit: 123456,
      totalCredit: 123456,
      lines: [
        { id: "l1", debit: 123456, credit: 0 },
        { id: "l2", debit: 0, credit: 123456 },
      ],
    });
    assert.equal(out.totalDebit, 1234.56);
    assert.equal(out.totalCredit, 1234.56);
    assert.equal(out.lines[0].debit, 1234.56);
    assert.equal(out.lines[0].credit, 0);
    assert.equal(out.lines[1].debit, 0);
    assert.equal(out.lines[1].credit, 1234.56);
  });

  test("leaves non-ledger fields untouched", () => {
    const out = journalEntryToRupees({ id: "e1", memo: "x", totalDebit: 0, totalCredit: 0 });
    assert.equal(out.memo, "x");
    assert.equal(out.lines, undefined);
  });
});
