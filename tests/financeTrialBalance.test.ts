import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trialBalance,
  pnl,
  balanceSheet,
  filterZeroBalances,
  type GlAccountLike,
  type JournalEntryLike,
} from "../src/lib/finance/trialBalance";

const accounts: GlAccountLike[] = [
  { code: "1010", name: "Cash", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT" },
  { code: "1020", name: "Bank", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT" },
  { code: "1030", name: "AR", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT" },
  { code: "4010", name: "Sales", type: "REVENUE", group: "SALES_REVENUE", normalBalance: "CREDIT" },
  { code: "5010", name: "RM Consumed", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT" },
  { code: "5050", name: "Mfg OH", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT" },
  { code: "2010", name: "AP", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT" },
  { code: "3010", name: "Capital", type: "EQUITY", group: "CAPITAL", normalBalance: "CREDIT" },
];

const entries: JournalEntryLike[] = [
  {
    lines: [
      { accountCode: "1010", side: "DEBIT", amount: 100_00 },
      { accountCode: "3010", side: "CREDIT", amount: 100_00 },
    ],
  },
  {
    lines: [
      { accountCode: "1020", side: "DEBIT", amount: 50_00 },
      { accountCode: "1010", side: "CREDIT", amount: 50_00 },
    ],
  },
];

test("trialBalance: aggregates debits and credits per account", () => {
  const tb = trialBalance(accounts, entries);
  assert.equal(tb.totalDebit, 150_00);
  assert.equal(tb.totalCredit, 150_00);
  assert.equal(tb.balanced, true);

  const cash = tb.accounts.find((a) => a.code === "1010");
  assert.ok(cash);
  assert.equal(cash?.debit, 100_00);
  assert.equal(cash?.credit, 50_00);
  assert.equal(cash?.netBalance, 50_00);
});

test("trialBalance: zero-balance filter", () => {
  const tb = trialBalance(accounts, entries);
  const nonZero = filterZeroBalances(tb);
  const zeroCodes = nonZero.filter((a) => a.debit === 0 && a.credit === 0).map((a) => a.code);
  assert.equal(zeroCodes.length, 0);
  assert.ok(nonZero.length > 0);
});

test("pnl: revenue - expenses = net profit", () => {
  const pnlEntries: JournalEntryLike[] = [
    {
      lines: [
        { accountCode: "1010", side: "DEBIT", amount: 100_00 },
        { accountCode: "4010", side: "CREDIT", amount: 100_00 },
      ],
    },
    {
      lines: [
        { accountCode: "5010", side: "DEBIT", amount: 40_00 },
        { accountCode: "1010", side: "CREDIT", amount: 40_00 },
      ],
    },
    {
      lines: [
        { accountCode: "5050", side: "DEBIT", amount: 20_00 },
        { accountCode: "1020", side: "CREDIT", amount: 20_00 },
      ],
    },
  ];
  const result = pnl(accounts, pnlEntries, ["4010"], ["5010", "5050"]);
  assert.equal(result.revenue, 100_00);
  assert.equal(result.expenses, 60_00);
  assert.equal(result.netProfit, 40_00);
});

test("balanceSheet: assets = liabilities + equity", () => {
  const result = balanceSheet(
    accounts,
    entries,
    ["1010", "1020", "1030"],
    ["2010"],
    ["3010"],
  );
  assert.equal(result.assets, 100_00);
  assert.equal(result.liabilities, 0);
  assert.equal(result.equity, 100_00);
  assert.equal(result.balanced, true);
});
