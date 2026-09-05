/**
 * C6-4 — Treasury engine: bank reconciliation, cheque numbering.
 * Pure functions; no DB.
 */

export interface BankStatementEntry {
  date: string; // ISO
  description: string;
  amount: number; // paise (positive = deposit, negative = withdrawal)
  reference?: string;
}

export interface BookEntry {
  date: string; // ISO
  description: string;
  amount: number; // paise
  reference?: string;
}

export interface ReconciledMatch {
  statementIndex: number;
  bookIndex: number;
  amount: number;
  date: string;
}

export interface ReconciliationResult {
  matched: ReconciledMatch[];
  unmatchedStatement: BankStatementEntry[];
  unmatchedBook: BookEntry[];
}

export function reconcileBank(
  statement: BankStatementEntry[],
  book: BookEntry[],
  tolerancePaise: number = 0,
): ReconciliationResult {
  const matched: ReconciledMatch[] = [];
  const unmatchedStatement: BankStatementEntry[] = [];
  const unmatchedBook: BookEntry[] = [];

  const usedBook = new Set<number>();
  const usedStatement = new Set<number>();

  for (let s = 0; s < statement.length; s++) {
    const sEntry = statement[s];
    let bestMatch: { b: number; diff: number } | null = null;

    for (let b = 0; b < book.length; b++) {
      if (usedBook.has(b)) continue;
      const bEntry = book[b];
      const amountDiff = Math.abs(sEntry.amount - bEntry.amount);
      const dateMatch = sEntry.date === bEntry.date;
      const descMatch =
        sEntry.description.toLowerCase().includes(bEntry.description.toLowerCase()) ||
        bEntry.description.toLowerCase().includes(sEntry.description.toLowerCase());

      if (amountDiff <= tolerancePaise && (dateMatch || descMatch)) {
        if (!bestMatch || amountDiff < bestMatch.diff) {
          bestMatch = { b, diff: amountDiff };
        }
      }
    }

    if (bestMatch) {
      matched.push({
        statementIndex: s,
        bookIndex: bestMatch.b,
        amount: statement[s].amount,
        date: statement[s].date,
      });
      usedBook.add(bestMatch.b);
      usedStatement.add(s);
    } else {
      unmatchedStatement.push(sEntry);
    }
  }

  for (let b = 0; b < book.length; b++) {
    if (!usedBook.has(b)) {
      unmatchedBook.push(book[b]);
    }
  }

  return { matched, unmatchedStatement, unmatchedBook };
}

// ---------------------------------------------------------------------------
// Cheque numbering
// ---------------------------------------------------------------------------

export function nextChequeNumber(date: Date = new Date()): string {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  return `CHQ-${year}-${String(1).padStart(3, "0")}`;
}
