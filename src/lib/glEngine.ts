import { prisma } from "./prisma";
import { nextSequenceTx } from "./sequence";
import { reserveIdempotency } from "./idempotency";
import {
  GlAccountType,
  GlAccountGroup,
  GlNormalBalance,
  JournalSource,
} from "@prisma/client";

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
 *  - Amounts are stored as Float (project-wide convention) rounded to 2dp.
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

export function periodForDate(date: Date): string {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

// ---------------------------------------------------------------------------
// DEFAULT CHART OF ACCOUNTS (Indian manufacturing standard, schedules VI-ish)
// ---------------------------------------------------------------------------
export interface CoaSeed {
  code: string;
  name: string;
  type: GlAccountType;
  group: GlAccountGroup;
  normalBalance: GlNormalBalance;
  description?: string;
}

export const DEFAULT_COA: CoaSeed[] = [
  // ---- ASSETS -------------------------------------------------------------
  { code: "1010", name: "Cash on Hand", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Petty cash & physical cash" },
  { code: "1020", name: "Bank Accounts", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "All operating bank balances" },
  { code: "1030", name: "Accounts Receivable", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Customer invoice receivables" },
  { code: "1040", name: "GST Input Credit (ITC)", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Input tax credit receivable" },
  { code: "1050", name: "Inventory — Raw Materials", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Raw material stock value" },
  { code: "1060", name: "Inventory — Work in Progress", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "WIP value on open work orders" },
  { code: "1070", name: "Inventory — Finished Goods", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Finished goods stock value" },
  { code: "1080", name: "Loans & Advances", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Employee / vendor advances" },
  { code: "1090", name: "Prepaid Expenses", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Insurance, rents paid in advance" },
  { code: "1210", name: "Plant & Machinery", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "CNC machines & equipment at cost" },
  { code: "1220", name: "Tools, Jigs & Fixtures", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "Tooling & fixtures register value" },
  { code: "1230", name: "Furniture & Fixtures", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "Office furniture & fittings" },
  { code: "1240", name: "Vehicles", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "Company vehicles at cost" },
  { code: "1250", name: "Computers & IT Equipment", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "IT assets at cost" },
  { code: "1260", name: "Accumulated Depreciation", type: "ASSET", group: "FIXED_ASSET", normalBalance: "CREDIT", description: "Contra-asset — cumulative depreciation" },
  { code: "1310", name: "Intangible Assets", type: "ASSET", group: "INTANGIBLE_ASSET", normalBalance: "DEBIT", description: "Software, IP, goodwill" },

  // ---- LIABILITIES --------------------------------------------------------
  { code: "2010", name: "Accounts Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Supplier invoice payables" },
  { code: "2020", name: "GST Output Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Output tax collected" },
  { code: "2030", name: "Statutory Dues (PF/ESI/PT)", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Payroll statutory payables" },
  { code: "2040", name: "TDS Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Tax deducted at source payable" },
  { code: "2050", name: "Salary & Wages Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Accrued payroll" },
  { code: "2060", name: "Customer Advances", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Advances received from customers" },
  { code: "2070", name: "Short-Term Loans", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Working capital loans, OD" },
  { code: "2210", name: "Long-Term Loans", type: "LIABILITY", group: "LONG_TERM_LIABILITY", normalBalance: "CREDIT", description: "Term loans, vehicle finance" },
  { code: "2220", name: "Provisions", type: "LIABILITY", group: "LONG_TERM_LIABILITY", normalBalance: "CREDIT", description: "Gratuity, leave encashment provisions" },

  // ---- EQUITY -------------------------------------------------------------
  { code: "3010", name: "Owner's Capital", type: "EQUITY", group: "CAPITAL", normalBalance: "CREDIT", description: "Proprietor / partner capital" },
  { code: "3020", name: "Share Capital", type: "EQUITY", group: "CAPITAL", normalBalance: "CREDIT", description: "Paid-up equity" },
  { code: "3030", name: "Reserves & Surplus", type: "EQUITY", group: "RESERVES", normalBalance: "CREDIT", description: "General reserves, retained surplus" },
  { code: "3040", name: "Retained Earnings", type: "EQUITY", group: "RETAINED_EARNINGS", normalBalance: "CREDIT", description: "Cumulative profit ploughed back" },

  // ---- REVENUE ------------------------------------------------------------
  { code: "4010", name: "Sales — Domestic", type: "REVENUE", group: "SALES_REVENUE", normalBalance: "CREDIT", description: "Domestic product sales" },
  { code: "4020", name: "Sales — Export", type: "REVENUE", group: "SALES_REVENUE", normalBalance: "CREDIT", description: "Export product sales" },
  { code: "4030", name: "Job Work / Machining Revenue", type: "REVENUE", group: "SALES_REVENUE", normalBalance: "CREDIT", description: "Contract machining & job work" },
  { code: "4040", name: "Scrap Sales", type: "REVENUE", group: "OTHER_REVENUE", normalBalance: "CREDIT", description: "Scrap / surplus material sales" },
  { code: "4050", name: "Interest Income", type: "REVENUE", group: "OTHER_REVENUE", normalBalance: "CREDIT", description: "Bank interest, delayed-payment interest" },
  { code: "4060", name: "Other Income", type: "REVENUE", group: "OTHER_REVENUE", normalBalance: "CREDIT", description: "Miscellaneous income" },

  // ---- EXPENSES -----------------------------------------------------------
  { code: "5010", name: "Raw Material Consumed", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Direct material cost of goods" },
  { code: "5020", name: "Direct Labour", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Shopfloor wages & OT" },
  { code: "5030", name: "Subcontracting Charges", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Special-process vendors" },
  { code: "5040", name: "Tooling & Consumables", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Cutting tools, inserts, coolant" },
  { code: "5050", name: "Manufacturing Overheads", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Power, rent, indirect shopfloor costs" },
  { code: "5060", name: "Quality & Calibration Costs", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Inspection, calibration, NDT" },
  { code: "5070", name: "Scrap & Rework Loss", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Non-conformance losses" },
  { code: "5080", name: "Salaries & Wages (Staff)", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Office & staff payroll" },
  { code: "5090", name: "Rent & Utilities", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Factory & office rent, power, water" },
  { code: "5100", name: "Repairs & Maintenance", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Machine & building maintenance" },
  { code: "5110", name: "Depreciation", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Period depreciation charge" },
  { code: "5120", name: "Travel & Conveyance", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Business travel" },
  { code: "5130", name: "Marketing & Sales Expense", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Advertising, commissions, exhibitions" },
  { code: "5140", name: "Administrative Expenses", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Office, professional fees, insurance" },
  { code: "5210", name: "Bank Charges", type: "EXPENSE", group: "FINANCE_EXPENSE", normalBalance: "DEBIT", description: "Bank & transaction charges" },
  { code: "5220", name: "Interest Expense", type: "EXPENSE", group: "FINANCE_EXPENSE", normalBalance: "DEBIT", description: "Interest on loans & OD" },
  { code: "5230", name: "Foreign Exchange Loss", type: "EXPENSE", group: "FINANCE_EXPENSE", normalBalance: "DEBIT", description: "FX realisation losses" },
  { code: "5310", name: "Tax Expenses", type: "EXPENSE", group: "TAX_EXPENSE", normalBalance: "DEBIT", description: "Income tax provision" },
];

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

  // Resolve accounts + validate every line
  const normalized: Array<{
    accountId: string;
    debit: number;
    credit: number;
    reference: string | null;
    narration: string | null;
  }> = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const raw of input.lines) {
    if (!raw || typeof raw !== "object") throw new GlError("LINE_INVALID", "Malformed journal line.");
    const debit = round2(Number(raw.debit || 0));
    const credit = round2(Number(raw.credit || 0));
    if (debit < 0 || credit < 0 || !Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new GlError("LINE_AMOUNT", "Debit/credit must be non-negative finite numbers.");
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

  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new GlError(
      "UNBALANCED",
      `Journal entry does not balance: debit ${totalDebit.toFixed(2)} vs credit ${totalCredit.toFixed(2)}.`,
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
    return entry;
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
    return reversal;
  });
}

// ---------------------------------------------------------------------------
// REPORTS — computed from JournalLine (posted entries only, always in balance)
// ---------------------------------------------------------------------------

interface LineWithAccount {
  debit: number;
  credit: number;
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
  let movementDr = 0;
  let movementCr = 0;
  let closingDr = 0;
  let closingCr = 0;

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
    row.debit = round2(row.debit);
    row.credit = round2(row.credit);
    row.openingDebit = round2(row.openingDebit);
    row.openingCredit = round2(row.openingCredit);
    const openingNet = row.openingDebit - row.openingCredit;
    const closingNet = round2(openingNet + row.debit - row.credit);
    row.closingDebit = closingNet > 0 ? closingNet : 0;
    row.closingCredit = closingNet < 0 ? -closingNet : 0;
    closingDr += row.closingDebit;
    closingCr += row.closingCredit;
    rows.push(row);
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));
  return {
    from,
    to,
    rows,
    totals: {
      movementDebit: round2(movementDr),
      movementCredit: round2(movementCr),
      closingDebit: round2(closingDr),
      closingCredit: round2(closingCr),
      balanced: Math.abs(closingDr - closingCr) < 0.01,
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
  let revenueTotal = 0;
  let expenseTotal = 0;

  const push = (map: Map<string, IncomeStatementSection>, group: string, acc: { id: string; code: string; name: string }, net: number) => {
    if (Math.abs(net) < 0.005) return;
    let sec = map.get(group);
    if (!sec) {
      sec = { group, accounts: [], total: 0 };
      map.set(group, sec);
    }
    sec.accounts.push({ code: acc.code, name: acc.name, amount: round2(net) });
    sec.total += net;
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
    [...map.values()].map((s) => ({ ...s, total: round2(s.total) })).sort((a, b) => a.group.localeCompare(b.group));

  return {
    from,
    to,
    revenue: toSections(revenue),
    expenses: toSections(expenses),
    totals: {
      revenue: round2(revenueTotal),
      expenses: round2(expenseTotal),
      netProfit: round2(revenueTotal - expenseTotal),
    },
  };
}

export async function getBalanceSheet(opts: { asOf: Date }) {
  const asOf = opts.asOf instanceof Date && !isNaN(opts.asOf.getTime()) ? opts.asOf : new Date();
  const lines = await fetchPostedLines(asOf);

  let assetsTotal = 0;
  let liabilitiesTotal = 0;
  let equityTotal = 0;
  let revenueNet = 0;
  let expenseNet = 0;
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
    acc.net += l.debit - l.credit;
  }

  for (const acc of map.values()) {
    const amount = round2(acc.net);
    if (Math.abs(amount) < 0.005) continue;
    switch (acc.type) {
      case "ASSET":
        if (acc.code === "1260") {
          // Accumulated depreciation is a contra-asset — still an asset section item
          assets.push({ code: acc.code, name: acc.name, amount: -amount });
          assetsTotal += -amount;
        } else {
          assets.push({ code: acc.code, name: acc.name, amount });
          assetsTotal += amount;
        }
        break;
      case "LIABILITY":
        liabilities.push({ code: acc.code, name: acc.name, amount: -amount });
        liabilitiesTotal += -amount;
        break;
      case "EQUITY":
        equity.push({ code: acc.code, name: acc.name, amount: -amount });
        equityTotal += -amount;
        break;
      case "REVENUE":
        revenueNet += amount;
        break;
      case "EXPENSE":
        expenseNet += amount;
        break;
    }
  }

  // Revenue accounts carry negative net (credited); expenses carry positive net (debited).
  // Net profit (positive when profitable) = revenue − expenses = -(revenueNet + expenseNet).
  const netProfit = round2(-(revenueNet + expenseNet));

  const totalLiabEquity = round2(liabilitiesTotal + equityTotal + netProfit);
  return {
    asOf,
    assets,
    liabilities,
    equity,
    netProfit,
    totals: {
      assets: round2(assetsTotal),
      liabilities: round2(liabilitiesTotal),
      equity: round2(equityTotal),
      liabilitiesPlusEquity: totalLiabEquity,
      balanced: Math.abs(assetsTotal - totalLiabEquity) < 0.01,
    },
  };
}