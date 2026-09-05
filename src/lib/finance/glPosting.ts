/**
 * C6-3 — GL posting engine: double-entry journal lines, reversals, balance integrity.
 * Pure functions; no DB.
 */

export type JournalLineSide = "DEBIT" | "CREDIT";

export interface JournalLine {
  accountCode: string;
  side: JournalLineSide;
  amount: number; // paise
  narration?: string;
}

export interface JournalEntry {
  date: string; // ISO
  period: string; // YYYY-MM
  narration: string;
  lines: JournalLine[];
}

export interface PostResult {
  ok: true;
  entry: JournalEntry;
  totalDebit: number;
  totalCredit: number;
}

export interface BalanceMismatch {
  ok: false;
  code: "BALANCE_MISMATCH";
  totalDebit: number;
  totalCredit: number;
  message: string;
}

export type PostingResult = PostResult | BalanceMismatch;

export function postJournalEntry(entry: JournalEntry): PostingResult {
  if (!entry.lines || entry.lines.length === 0) {
    return {
      ok: false,
      code: "BALANCE_MISMATCH",
      totalDebit: 0,
      totalCredit: 0,
      message: "Journal entry must have at least one line",
    };
  }

  const totalDebit = entry.lines
    .filter((l) => l.side === "DEBIT")
    .reduce((s, l) => s + (Math.round(l.amount) || 0), 0);

  const totalCredit = entry.lines
    .filter((l) => l.side === "CREDIT")
    .reduce((s, l) => s + (Math.round(l.amount) || 0), 0);

  if (totalDebit !== totalCredit) {
    return {
      ok: false,
      code: "BALANCE_MISMATCH",
      totalDebit,
      totalCredit,
      message: `Debits ${totalDebit} do not equal credits ${totalCredit}`,
    };
  }

  return { ok: true, entry, totalDebit, totalCredit };
}

// ---------------------------------------------------------------------------
// Reversal — create a mirror entry with opposite signs
// ---------------------------------------------------------------------------

export interface ReversalInput {
  originalEntry: JournalEntry;
  reason: string;
  date?: string;
}

export function reverseJournalEntry(input: ReversalInput): JournalEntry {
  const date = input.date || new Date().toISOString().split("T")[0];
  const period = input.originalEntry.period;
  const reversedLines: JournalLine[] = input.originalEntry.lines.map((l) => ({
    accountCode: l.accountCode,
    side: l.side === "DEBIT" ? "CREDIT" : "DEBIT",
    amount: l.amount,
    narration: `Reversal: ${input.reason}`,
  }));

  return {
    date,
    period,
    narration: `Reversal of: ${input.originalEntry.narration}. Reason: ${input.reason}`,
    lines: reversedLines,
  };
}

// ---------------------------------------------------------------------------
// Integrity helpers
// ---------------------------------------------------------------------------

export function isBalanced(entry: JournalEntry): boolean {
  const result = postJournalEntry(entry);
  return result.ok;
}

export function journalEntryToRupees(entry: JournalEntry): JournalEntry {
  return {
    ...entry,
    lines: entry.lines.map((l) => ({
      ...l,
      amount: l.amount / 100,
    })),
  };
}
