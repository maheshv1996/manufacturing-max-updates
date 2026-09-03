/**
 * Ledger integrity — the counterpart to the GL backfill workbench.
 * ---------------------------------------------------------------------------
 * Backfill replays *missing* documents into the books; this checks the books
 * themselves:
 *
 *   1. Unbalanced entries — POSTED journal entries whose line debits ≠ credits.
 *      (DRAFT entries are exempt: a draft is allowed to be half-written.)
 *   2. Unposted documents — the same candidate enumeration the backfill uses,
 *      so a scheduled sweep can surface "the ledger is missing X documents".
 *
 * Every scan is persisted as a GlIntegrityRun row (kind = INTEGRITY) so the
 * finance hub and the workbench can show what the last sweep found and when —
 * provenance for anything a repair later touches. Backfill executions write
 * kind = BACKFILL rows through the same table.
 */
import { prisma } from "./prisma";
import { listGlBackfillCandidates } from "./glBackfill";

export interface UnbalancedIssue {
  entryNumber: string;
  date: string;
  memo: string;
  source: string;
  debitPaise: number;
  creditPaise: number;
  diffRupees: number; // debit − credit, rupees; nonzero means unbalanced
}

export interface IntegritySummary {
  checkedAt: string;
  totalEntries: number;
  unbalancedCount: number;
  issues: UnbalancedIssue[];
  unpostedTotal: number;
  unpostedByKind: Record<string, number>;
}

interface UnbalancedResult {
  count: number;
  sample: UnbalancedIssue[];
}

/** POSTED entries whose lines don't balance (paise-exact). */
async function findUnbalanced(): Promise<UnbalancedResult> {
  const joined = `
    FROM "JournalEntry" je
    JOIN (
      SELECT "entryId",
             COALESCE(SUM("debit"), 0)::bigint AS dr,
             COALESCE(SUM("credit"), 0)::bigint AS cr
      FROM "JournalLine"
      GROUP BY "entryId"
    ) d ON d."entryId" = je.id
    WHERE je."status" = 'POSTED' AND d.dr <> d.cr
  `;
  const [countRow, sampleRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT COUNT(*)::int AS n ${joined}`,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT je."entryNumber", je."date", je."memo", je."source",
              d.dr AS "debitPaise", d.cr AS "creditPaise"
       ${joined}
       ORDER BY je."date" DESC
       LIMIT 20`,
    ),
  ]);
  const sample = sampleRows.map((r: any) => ({
    entryNumber: String(r.entryNumber),
    date: r.date instanceof Date ? r.date.toISOString() : String(r.date || ""),
    memo: String(r.memo || ""),
    source: String(r.source || ""),
    debitPaise: Number(r.debitPaise) || 0,
    creditPaise: Number(r.creditPaise) || 0,
    diffRupees: ((Number(r.debitPaise) || 0) - (Number(r.creditPaise) || 0)) / 100,
  }));
  return { count: Number(countRow[0]?.n) || 0, sample };
}

/** Full integrity scan — cheap enough for on-demand and daily sweeps. */
export async function checkLedgerIntegrity(): Promise<IntegritySummary> {
  const [unbalanced, totalEntries, unposted] = await Promise.all([
    findUnbalanced(),
    prisma.journalEntry.count(),
    listGlBackfillCandidates().catch(() => []), // enumeration must never fail the scan
  ]);
  const unpostedByKind: Record<string, number> = {};
  for (const c of unposted) {
    unpostedByKind[c.kind] = (unpostedByKind[c.kind] || 0) + 1;
  }
  return {
    checkedAt: new Date().toISOString(),
    totalEntries,
    unbalancedCount: unbalanced.count,
    issues: unbalanced.sample,
    unpostedTotal: unposted.length,
    unpostedByKind,
  };
}

export interface RecordGlRunInput {
  kind: "BACKFILL" | "INTEGRITY";
  status: "OK" | "ISSUES" | "FAILED";
  actor: string;
  posted?: number;
  skipped?: number;
  failed?: number;
  unbalanced?: number;
  unposted?: number;
  issues?: unknown;
  details?: string;
}

/** Persist one repair/provenance event (backfill execution or integrity scan). */
export async function recordGlRun(input: RecordGlRunInput) {
  return prisma.glIntegrityRun.create({
    data: {
      kind: input.kind,
      status: input.status,
      actor: input.actor,
      posted: input.posted ?? 0,
      skipped: input.skipped ?? 0,
      failed: input.failed ?? 0,
      unbalanced: input.unbalanced ?? 0,
      unposted: input.unposted ?? 0,
      issues: input.issues ? JSON.parse(JSON.stringify(input.issues)) : undefined,
      details: input.details ? String(input.details).slice(0, 2000) : null,
    },
  });
}

export type RunView = {
  id: string;
  runAt: string;
  kind: string;
  status: string;
  actor: string;
  posted: number;
  skipped: number;
  failed: number;
  unbalanced: number;
  unposted: number;
  details: string | null;
};

/** Recent run history (backfills + integrity scans), newest first. */
export async function recentGlRuns(limit = 10): Promise<RunView[]> {
  const rows = await prisma.glIntegrityRun.findMany({
    orderBy: { runAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    runAt: r.runAt.toISOString(),
    kind: r.kind,
    status: r.status,
    actor: r.actor,
    posted: r.posted,
    skipped: r.skipped,
    failed: r.failed,
    unbalanced: r.unbalanced,
    unposted: r.unposted,
    details: r.details,
  }));
}
