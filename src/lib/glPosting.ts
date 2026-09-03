/**
 * GL auto-posting for operational money events (procurement & sales).
 *
 * When a document that moves money is created or paid (supplier invoice,
 * supplier payment, sales invoice, customer payment) the ledger should
 * reflect it — otherwise the double-entry books silently miss the platform's
 * biggest revenue and cost flows. These helpers post the balanced journal
 * entry for each event:
 *
 *   - Supplier invoice  → Dr Inventory, Dr GST ITC, Cr Accounts Payable
 *   - Supplier payment  → Dr Accounts Payable, Cr Bank
 *   - Sales invoice     → Dr Accounts Receivable, Cr Sales, Cr GST Output
 *   - Customer payment  → Dr Bank, Cr Accounts Receivable
 *
 * Posting is best-effort by design: the business document must never be
 * blocked by a ledger hiccup. Failures are recorded as GL_AUTOPOST_FAILED
 * audit entries so finance can catch up. Every event is idempotent per
 * (source, sourceId) — one invoice or payment posts exactly once even if the
 * caller replays it.
 */
import { prisma } from "./prisma";
import { ensureChartOfAccounts, postJournalEntry } from "./glEngine";
import { logAudit } from "./audit";

export interface AutoPostLine {
  accountCode: string;
  debit?: number;
  credit?: number;
  reference?: string;
  narration?: string;
}

export interface AutoPostInput {
  source: "VOUCHER" | "INVOICE" | "PAYMENT" | "SYSTEM";
  sourceId: string; // unique per money event (invoice id, payment id, treasury txn id)
  memo: string;
  createdBy: string;
  date?: Date;
  lines: AutoPostLine[];
}

export async function autoPostToGL(
  input: AutoPostInput,
): Promise<{ ok: boolean; skipped: boolean; entryNumber?: string; error?: string }> {
  try {
    await ensureChartOfAccounts();
    const existing = await prisma.journalEntry.findFirst({
      where: { source: input.source as any, sourceId: input.sourceId },
      select: { id: true, entryNumber: true },
    });
    if (existing) {
      return { ok: true, skipped: true, entryNumber: existing.entryNumber };
    }
    const entry = await postJournalEntry({
      date: input.date || new Date(),
      memo: String(input.memo).slice(0, 500),
      source: input.source as any,
      sourceId: input.sourceId,
      createdBy: input.createdBy || "system",
      lines: input.lines,
    });
    return { ok: true, skipped: false, entryNumber: entry.entryNumber };
  } catch (e: any) {
    try {
      // Persist the FULL posting intent so finance can repair later — the
      // GL_AUTOPOST_FAILED audit row doubles as a backfill work queue.
      await logAudit({
        actor: input.createdBy || "system",
        action: "GL_AUTOPOST_FAILED",
        entityType: "GL_JOURNAL",
        entityId: input.sourceId,
        details: JSON.stringify({
          reason: `${e?.code || "ERR"}: ${e?.message || e}`.slice(0, 500),
          intent: {
            source: input.source,
            sourceId: input.sourceId,
            memo: input.memo,
            createdBy: input.createdBy || "system",
            date: input.date ? input.date.toISOString() : undefined,
            lines: input.lines,
          },
        }).slice(0, 6000),
      });
    } catch {
      // audit must never take the post down further
    }
    return {
      ok: false,
      skipped: false,
      error: `${e?.code || "ERR"}: ${e?.message || e}`.slice(0, 300),
    };
  }
}
