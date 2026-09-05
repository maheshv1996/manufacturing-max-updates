/**
 * C6-3 — Trial balance, P&L, and balance sheet from posted journal entries.
 * Pure functions; no DB.
 */

import type { GlAccountType, GlAccountGroup, GlNormalBalance } from "./glCore";

export interface GlAccountLike {
  code: string;
  name?: string;
  type: GlAccountType;
  group: GlAccountGroup;
  normalBalance: GlNormalBalance;
}

export interface JournalEntryLike {
  lines: Array<{
    accountCode: string;
    side: "DEBIT" | "CREDIT";
    amount: number; // paise
  }>;
}

export interface AccountBalance {
  code: string;
  name: string;
  type: GlAccountType;
  group: GlAccountGroup;
  normalBalance: GlNormalBalance;
  debit: number;
  credit: number;
  netBalance: number; // positive = debit balance, negative = credit balance
}

export interface TrialBalance {
  accounts: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface PnlResult {
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface BalanceSheetResult {
  assets: number;
  liabilities: number;
  equity: number;
  balanced: boolean;
}

function roundPaise(n: number): number {
  return Math.round(n) || 0;
}

export function trialBalance(accounts: GlAccountLike[], entries: JournalEntryLike[]): TrialBalance {
  const accountMap = new Map<string, GlAccountLike>();
  for (const a of accounts) {
    accountMap.set(a.code, a);
  }

  const balances = new Map<string, { debit: number; credit: number }>();
  for (const a of accounts) {
    balances.set(a.code, { debit: 0, credit: 0 });
  }

  for (const entry of entries) {
    for (const line of entry.lines) {
      const existing = balances.get(line.accountCode);
      if (!existing) continue;
      const amount = roundPaise(line.amount);
      if (line.side === "DEBIT") {
        existing.debit += amount;
      } else {
        existing.credit += amount;
      }
    }
  }

  const accountBalances: AccountBalance[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const a of accounts) {
    const b = balances.get(a.code) || { debit: 0, credit: 0 };
    const debit = roundPaise(b.debit);
    const credit = roundPaise(b.credit);
    totalDebit += debit;
    totalCredit += credit;

    let netBalance: number;
    if (a.normalBalance === "DEBIT") {
      netBalance = debit - credit;
    } else {
      netBalance = credit - debit;
    }

    accountBalances.push({
      code: a.code,
      name: accountMap.get(a.code)?.name ?? a.code,
      type: a.type,
      group: a.group,
      normalBalance: a.normalBalance,
      debit,
      credit,
      netBalance,
    });
  }

  return {
    accounts: accountBalances,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  };
}

export function pnl(
  accounts: GlAccountLike[],
  entries: JournalEntryLike[],
  revenueCodes: string[],
  expenseCodes: string[],
): PnlResult {
  const tb = trialBalance(accounts, entries);
  const revenueAccountCodes = new Set(revenueCodes);
  const expenseAccountCodes = new Set(expenseCodes);

  let revenue = 0;
  let expenses = 0;

  for (const acc of tb.accounts) {
    if (revenueAccountCodes.has(acc.code)) {
      revenue += acc.netBalance;
    } else if (expenseAccountCodes.has(acc.code)) {
      expenses += acc.netBalance;
    }
  }

  return {
    revenue: roundPaise(revenue),
    expenses: roundPaise(expenses),
    netProfit: roundPaise(revenue - expenses),
  };
}

export function balanceSheet(
  accounts: GlAccountLike[],
  entries: JournalEntryLike[],
  assetCodes: string[],
  liabilityCodes: string[],
  equityCodes: string[],
): BalanceSheetResult {
  const tb = trialBalance(accounts, entries);
  const assetAccountCodes = new Set(assetCodes);
  const liabilityAccountCodes = new Set(liabilityCodes);
  const equityAccountCodes = new Set(equityCodes);

  let assets = 0;
  let liabilities = 0;
  let equity = 0;

  for (const acc of tb.accounts) {
    if (assetAccountCodes.has(acc.code)) {
      assets += acc.netBalance;
    } else if (liabilityAccountCodes.has(acc.code)) {
      liabilities += acc.netBalance;
    } else if (equityAccountCodes.has(acc.code)) {
      equity += acc.netBalance;
    }
  }

  return {
    assets: roundPaise(assets),
    liabilities: roundPaise(liabilities),
    equity: roundPaise(equity),
    balanced: roundPaise(assets) === roundPaise(liabilities + equity),
  };
}

export function filterZeroBalances(tb: TrialBalance): AccountBalance[] {
  return tb.accounts.filter((a) => a.debit !== 0 || a.credit !== 0);
}
