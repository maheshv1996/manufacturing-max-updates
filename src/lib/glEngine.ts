import { prisma } from "./prisma";
import { nextSequenceTx } from "./sequence";
import { reserveIdempotency } from "./idempotency";
import { toPaise, fromPaise } from "./money";
import { DEFAULT_COA, periodForDate, journalEntryToRupees } from "./glCore";
import type {
  GlAccountType,
  GlAccountGroup,
  JournalSource,
} from "@prisma/client";

// Pure GL facts live in ./glCore (DB-free, unit-testable) — re-export so app
// callers keep a single import site.
export { DEFAULT_COA, periodForDate, journalEntryToRupees } from "./glCore";
export type { CoaSeed } from "./glCore";

/**
 * GL / Double-Entry Accounting Engine
 * -----------------------------------
 * The financial-accounting core the platform was missing: a real chart of
 * accounts, balanced journal posting, reversal, and audit-grade reports
 * (trial balance / income statement / balance sheet). Money stays queryable
 * from JournalLine — no running balances to drift out of sync.
 *
 * Conventions:
 *  - Every journal entry is balanced: totalDebit === totalCredit.
 *  - Amounts are FIXED-POINT: the API accepts rupees, but everything stored
 *    in JournalEntry/JournalLine and everything summed internally is INTEGER
 *    PAISE (see src/lib/money.ts). Integer arithmetic cannot drift, so the
 *    ledger balances exactly and the audit trail is clean at the paise.
 *  - Entry numbers come from the atomic SequenceCounter (JE-YYYY-NNNN).
 *  - All mutations are transactional + audit-logged by the route layer.
 */

export class GlError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Rupee display for paise-held error messages. */
function rupees(paise: number): string {
  return fromPaise(paise).toFixed(2);
}

/** Idempotent bootstrap — seeds the standard COA once, on first use. */
export async function ensureChartOfAccounts(): Promise<number> {
  const count = await prisma.glAccount.count();
  if (count > 0) return 0;
  const existingCodes = new Set(
    (await prisma.glAccount.findMany({ select: { code: true } })).map((a) => a.code),
  );
  const rows = DEFAULT_COA.filter((a) => !existingCodes.has(a.code)).map((a) => ({
    ...a,
    isSystem: true,
    createdBy: "system",
  }));
  if (rows.length === 0) return 0;
  await prisma.glAccount.createMany({ data: rows });
  return rows.length;
}

export interface JournalLineInput {
  accountId?: string;
  accountCode?: string;
  debit?: number;
  credit?: number;
  reference?: string;
  narration?: string;
}

export interface JournalEntryInput {
  date: string | Date;
  memo: string;
  lines: JournalLineInput[];
  source?: JournalSource;
  sourceId?: string;
  createdBy: string;
  /** X-Client-ID / body clientId — dedupes replays via the IdempotencyKey table */
  clientId?: string | null;
}

/** Post a balanced journal entry. Throws GlError with a machine-readable code. */
export async function postJournalEntry(input: JournalEntryInput) {
  const memo = String(input.memo || "").trim();
  if (!memo) throw new GlError("MEMO_REQUIRED", "Journal entry memo is required.");
  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new GlError("LINES_MIN", "A journal entry needs at least two lines.");
  }
  if (input.lines.length > 200) {
    throw new GlError("LINES_MAX", "A journal entry cannot exceed 200 lines.");
  }

  const date = input.date instanceof Date ? input.date : new Date(input.date);
  if (isNaN(date.getTime())) throw new GlError("INVALID_DATE", "Invalid entry date.");

  // Resolve accounts + validate every line. All amounts are converted to
  // INTEGER paise up front so the balance check below is exact.
  const normalized: Array<{
    accountId: string;
    debit: number;
    credit: number;
    reference: string | null;
    narration: string | null;
  }> = [];
  let totalDebit = 0; // paise
  let totalCredit = 0; // paise

  for (const raw of input.lines) {
    if (!raw || typeof raw !== "object") throw new GlError("LINE_INVALID", "Malformed journal line.");
    const debit = toPaise(Number(raw.debit || 0));
    const credit = toPaise(Number(raw.credit || 0));
    if (debit < 0 || credit < 0 || !Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new GlError("LINE_AMOUNT", "Debit/credit must be non-negative finite amounts.");
    }
    if (debit === 0 && credit === 0) throw new GlError("LINE_EMPTY", "Each line needs a debit or credit amount.");
    if (debit > 0 && credit > 0) {
      throw new GlError("LINE_BOTH", "A line cannot have both debit and credit. Split into two lines.");
    }

    let account = null;
    if (raw.accountId) {
      account = await prisma.glAccount.findUnique({ where: { id: raw.accountId } });
    } else if (raw.accountCode) {
      account = await prisma.glAccount.findUnique({ where: { code: raw.accountCode } });
    }
    if (!account) {
      throw new GlError("ACCOUNT_NOT_FOUND", `GL account not found for ${raw.accountCode || raw.accountId}.`);
    }
    if (!account.isActive) {
      throw new GlError("ACCOUNT_INACTIVE", `GL account ${account.code} ${account.name} is inactive.`);
    }

    normalized.push({
      accountId: account.id,
      debit,
      credit,
      reference: raw.reference ? String(raw.reference).slice(0, 200) : null,
      narration: raw.narration ? String(raw.narration).slice(0, 1000) : null,
    });
    totalDebit += debit;
    totalCredit += credit;
  }

  if (totalDebit !== totalCredit) {
    throw new GlError(
      "UNBALANCED",
      `Journal entry does not balance: debit ${rupees(totalDebit)} vs credit ${rupees(totalCredit)}.`,
    );
  }
  if (totalDebit <= 0) throw new GlError("ZERO_AMOUNT", "Journal entry total must be positive.");

  const source = input.source || "MANUAL";
  const period = periodForDate(date);
  const clientId = input.clientId ? String(input.clientId).trim() : null;

  // Fiscal-period gate: a CLOSED period must never receive entries — manual or
  // auto-posted. Missing period rows default to OPEN (lazy period creation).
  const periodRow = await prisma.fiscalPeriod.findUnique({ where: { code: period } });
  if (periodRow && periodRow.status === "CLOSED") {
    throw new GlError(
      "PERIOD_CLOSED",
      `Fiscal period ${period} is CLOSED — reopen it before posting entries dated in this period.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    if (clientId) {
      const reserved = await reserveIdempotency(tx as any, clientId, "/api/finance/journals");
      if (!reserved) throw new GlError("DUPLICATE", "Duplicate request ignored (idempotent).");
    }
    const entryNumber = await nextSequenceTx(tx as any, "JE", 4, date);
    const entry = await (tx as any).journalEntry.create({
      data: {
        entryNumber,
        date,
        period,
        memo,
        status: "POSTED",
        source,
        sourceId: input.sourceId ? String(input.sourceId).slice(0, 200) : null,
        totalDebit,
        totalCredit,
        createdBy: String(input.createdBy || "system").slice(0, 100),
        postedBy: String(input.createdBy || "system").slice(0, 100),
        postedAt: new Date(),
        lines: {
          create: normalized.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            reference: l.reference,
            narration: l.narration,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
    return journalEntryToRupees(entry);
  });
}

/** Reverse a POSTED entry: mirror-image entry, both linked. Throws if not reversible. */
export async function reverseJournalEntry(
  id: string,
  by: string,
  clientId?: string | null,
) {
  const existing = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!existing) throw new GlError("ENTRY_NOT_FOUND", "Journal entry not found.");
  if (existing.status === "REVERSED") throw new GlError("ALREADY_REVERSED", "This entry is already reversed.");
  if (existing.status !== "POSTED") throw new GlError("NOT_POSTED", "Only POSTED entries can be reversed.");

  // Fiscal-period gate: the reversal is dated today, so its period must be open.
  const reversalDate = new Date();
  const reversalPeriod = periodForDate(reversalDate);
  const periodRow = await prisma.fiscalPeriod.findUnique({ where: { code: reversalPeriod } });
  if (periodRow && periodRow.status === "CLOSED") {
    throw new GlError(
      "PERIOD_CLOSED",
      `Fiscal period ${reversalPeriod} is CLOSED — reopen it before posting entries dated in this period.`,
    );
  }

  const idemClientId = clientId ? String(clientId).trim() : null;
  return prisma.$transaction(async (tx) => {
    if (idemClientId) {
      const reserved = await reserveIdempotency(tx as any, idemClientId, "/api/finance/journals/reverse");
      if (!reserved) throw new GlError("DUPLICATE", "Duplicate request ignored (idempotent).");
    }
    const entryNumber = await nextSequenceTx(tx as any, "JE", 4, reversalDate);
    const reversal = await (tx as any).journalEntry.create({
      data: {
        entryNumber,
        date: reversalDate,
        period: reversalPeriod,
        memo: `Reversal of ${existing.entryNumber} — ${existing.memo}`.slice(0, 500),
        status: "POSTED",
        source: "SYSTEM",
        sourceId: existing.id,
        totalDebit: existing.totalCredit,
        totalCredit: existing.totalDebit,
        createdBy: String(by || "system").slice(0, 100),
        postedBy: String(by || "system").slice(0, 100),
        postedAt: new Date(),
        reversalOfId: existing.id,
        lines: {
          create: existing.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.credit,
            credit: l.debit,
            reference: l.reference ? `REV:${l.reference}` : null,
            narration: l.narration ? `Reversal — ${l.narration}`.slice(0, 1000) : null,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
    await (tx as any).journalEntry.update({
      where: { id: existing.id },
      data: { status: "REVERSED", reversedById: reversal.id },
    });
    return journalEntryToRupees(reversal);
  });
}

// ---------------------------------------------------------------------------
// REPORTS — computed from JournalLine (posted entries only, always in balance)
// ---------------------------------------------------------------------------

interface LineWithAccount {
  debit: number; // paise
  credit: number; // paise
  date: Date;
  account: { id: string; code: string; name: string; type: GlAccountType; group: GlAccountGroup | null };
}

async function fetchPostedLines(upTo: Date): Promise<LineWithAccount[]> {
  const lines = await prisma.journalLine.findMany({
    where: {
      // REVERSED originals stay in the ledger so the mirror-image reversal nets them
      // to zero — excluding them would leave the reversal lines standing alone.
      entry: { status: { in: ["POSTED", "REVERSED"] }, date: { lte: upTo } },
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { id: true, code: true, name: true, type: true, group: true } },
      entry: { select: { date: true } },
    },
  });
  return lines.map((l) => ({
    debit: l.debit,
    credit: l.credit,
    date: l.entry.date,
    account: l.account,
  })) as unknown as LineWithAccount[];
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: GlAccountType;
  group: GlAccountGroup | null;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
}

export async function getTrialBalance(opts: { from: Date; to: Date }) {
  const from = opts.from instanceof Date && !isNaN(opts.from.getTime()) ? opts.from : new Date(0);
  const to = opts.to instanceof Date && !isNaN(opts.to.getTime()) ? opts.to : new Date();
  const lines = await fetchPostedLines(to);

  const map = new Map<string, TrialBalanceRow>();
  let movementDr = 0; // paise
  let movementCr = 0; // paise
  let closingDr = 0; // paise
  let closingCr = 0; // paise

  for (const l of lines) {
    let row = map.get(l.account.id);
    if (!row) {
      row = {
        accountId: l.account.id,
        code: l.account.code,
        name: l.account.name,
        type: l.account.type,
        group: l.account.group,
        openingDebit: 0,
        openingCredit: 0,
        debit: 0,
        credit: 0,
        closingDebit: 0,
        closingCredit: 0,
      };
      map.set(l.account.id, row);
    }
    const inPeriod = l.date >= from;
    if (inPeriod) {
      row.debit += l.debit;
      row.credit += l.credit;
      movementDr += l.debit;
      movementCr += l.credit;
    } else {
      row.openingDebit += l.debit;
      row.openingCredit += l.credit;
    }
  }

  const rows: TrialBalanceRow[] = [];
  for (const row of map.values()) {
    const openingNet = row.openingDebit - row.openingCredit; // paise
    const closingNet = openingNet + row.debit - row.credit; // paise — exact integer math
    const closingNetRupees = fromPaise(closingNet);
    const rowRupees: TrialBalanceRow = {
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      type: row.type,
      group: row.group,
      openingDebit: fromPaise(row.openingDebit),
      openingCredit: fromPaise(row.openingCredit),
      debit: fromPaise(row.debit),
      credit: fromPaise(row.credit),
      closingDebit: closingNetRupees > 0 ? closingNetRupees : 0,
      closingCredit: closingNetRupees < 0 ? -closingNetRupees : 0,
    };
    closingDr += closingNet > 0 ? closingNet : 0;
    closingCr += closingNet < 0 ? -closingNet : 0;
    rows.push(rowRupees);
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));
  return {
    from,
    to,
    rows,
    totals: {
      movementDebit: fromPaise(movementDr),
      movementCredit: fromPaise(movementCr),
      closingDebit: fromPaise(closingDr),
      closingCredit: fromPaise(closingCr),
      balanced: closingDr === closingCr, // integer paise — exact
    },
  };
}

export interface IncomeStatementSection {
  group: string;
  accounts: Array<{ code: string; name: string; amount: number }>;
  total: number;
}

export async function getIncomeStatement(opts: { from: Date; to: Date }) {
  const from = opts.from instanceof Date && !isNaN(opts.from.getTime()) ? opts.from : new Date(0);
  const to = opts.to instanceof Date && !isNaN(opts.to.getTime()) ? opts.to : new Date();
  const lines = await fetchPostedLines(to);

  const revenue = new Map<string, IncomeStatementSection>();
  const expenses = new Map<string, IncomeStatementSection>();
  let revenueTotal = 0; // paise
  let expenseTotal = 0; // paise

  const push = (map: Map<string, IncomeStatementSection>, group: string, acc: { id: string; code: string; name: string }, net: number) => {
    if (net === 0) return;
    let sec = map.get(group);
    if (!sec) {
      sec = { group, accounts: [], total: 0 };
      map.set(group, sec);
    }
    sec.accounts.push({ code: acc.code, name: acc.name, amount: fromPaise(net) });
    sec.total += net; // keep paise internally for the section total
  };

  for (const l of lines) {
    if (l.date < from) continue;
    const acc = l.account;
    if (acc.type === "REVENUE") {
      const net = l.credit - l.debit;
      push(revenue, acc.group || "OTHER_REVENUE", acc, net);
      revenueTotal += net;
    } else if (acc.type === "EXPENSE") {
      const net = l.debit - l.credit;
      push(expenses, acc.group || "OPERATING_EXPENSE", acc, net);
      expenseTotal += net;
    }
  }

  const toSections = (map: Map<string, IncomeStatementSection>) =>
    [...map.values()].map((s) => ({ ...s, total: fromPaise(s.total) })).sort((a, b) => a.group.localeCompare(b.group));

  return {
    from,
    to,
    revenue: toSections(revenue),
    expenses: toSections(expenses),
    totals: {
      revenue: fromPaise(revenueTotal),
      expenses: fromPaise(expenseTotal),
      netProfit: fromPaise(revenueTotal - expenseTotal),
    },
  };
}

export async function getBalanceSheet(opts: { asOf: Date }) {
  const asOf = opts.asOf instanceof Date && !isNaN(opts.asOf.getTime()) ? opts.asOf : new Date();
  const lines = await fetchPostedLines(asOf);

  let assetsTotal = 0; // paise
  let liabilitiesTotal = 0; // paise
  let equityTotal = 0; // paise
  let revenueNet = 0; // paise
  let expenseNet = 0; // paise
  const assets: Array<{ code: string; name: string; amount: number }> = [];
  const liabilities: Array<{ code: string; name: string; amount: number }> = [];
  const equity: Array<{ code: string; name: string; amount: number }> = [];

  const map = new Map<string, { code: string; name: string; type: GlAccountType; net: number }>();
  for (const l of lines) {
    let acc = map.get(l.account.id);
    if (!acc) {
      acc = { code: l.account.code, name: l.account.name, type: l.account.type, net: 0 };
      map.set(l.account.id, acc);
    }
    acc.net += l.debit - l.credit; // exact integer paise
  }

  for (const acc of map.values()) {
    const paise = acc.net;
    if (paise === 0) continue;
    const amount = fromPaise(paise);
    switch (acc.type) {
      case "ASSET":
        if (acc.code === "1260") {
          // Accumulated depreciation is a contra-asset — still an asset section item
          assets.push({ code: acc.code, name: acc.name, amount: -amount });
          assetsTotal += -paise;
        } else {
          assets.push({ code: acc.code, name: acc.name, amount });
          assetsTotal += paise;
        }
        break;
      case "LIABILITY":
        liabilities.push({ code: acc.code, name: acc.name, amount: -amount });
        liabilitiesTotal += -paise;
        break;
      case "EQUITY":
        equity.push({ code: acc.code, name: acc.name, amount: -amount });
        equityTotal += -paise;
        break;
      case "REVENUE":
        revenueNet += paise;
        break;
      case "EXPENSE":
        expenseNet += paise;
        break;
    }
  }

  // Revenue accounts carry negative net (credited); expenses carry positive net (debited).
  // Net profit (positive when profitable) = revenue − expenses = -(revenueNet + expenseNet).
  const netProfitPaise = -(revenueNet + expenseNet);
  const netProfit = fromPaise(netProfitPaise);

  const totalLiabEquity = fromPaise(liabilitiesTotal + equityTotal + netProfitPaise);
  return {
    asOf,
    assets,
    liabilities,
    equity,
    netProfit,
    totals: {
      assets: fromPaise(assetsTotal),
      liabilities: fromPaise(liabilitiesTotal),
      equity: fromPaise(equityTotal),
      liabilitiesPlusEquity: totalLiabEquity,
      balanced: assetsTotal === liabilitiesTotal + equityTotal + netProfitPaise, // integer paise — exact
    },
  };
}
