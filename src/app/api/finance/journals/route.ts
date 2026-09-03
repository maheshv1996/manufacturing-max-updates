import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { postJournalEntry, ensureChartOfAccounts, GlError, periodForDate, journalEntryToRupees } from "@/lib/glEngine";
import { fromPaise } from "@/lib/money";
import { checkIdempotency, completeIdempotency } from "@/lib/idempotency";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureChartOfAccounts();

    const [entries, stats] = await Promise.all([
      prisma.journalEntry.findMany({
        orderBy: { date: "desc" },
        take: 300,
        include: { lines: { include: { account: { select: { code: true, name: true, type: true } } } } },
      }),
      prisma.journalEntry.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { totalDebit: true },
      }),
    ]);

    const now = new Date();
    const prefix = `JE-${now.getFullYear()}-`;
    const thisYear = entries.filter((e) => e.entryNumber.startsWith(prefix));

    return NextResponse.json({
      success: true,
      // Ledger rows are stored as integer paise — expose the rupee contract.
      entries: entries.map((e) => journalEntryToRupees(e)),
      stats: {
        posted: stats.find((s) => s.status === "POSTED")?._count._all || 0,
        reversed: stats.find((s) => s.status === "REVERSED")?._count._all || 0,
        postedValueYear: fromPaise(
          thisYear
            .filter((e) => e.status === "POSTED")
            .reduce((a, e) => a + e.totalDebit, 0),
        ),
      },
    });
  } catch (error) {
    console.error("GET /api/finance/journals error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const lineSchema = z
  .object({
    accountId: z.string().cuid().optional(),
    accountCode: z.string().min(2).max(10).optional(),
    debit: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
    credit: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
    reference: z.string().max(200).optional().nullable(),
    narration: z.string().max(1000).optional().nullable(),
  })
  .refine((l) => l.accountId || l.accountCode, {
    message: "Each line needs accountId or accountCode",
  });

const postJournalSchema = z.object({
  date: z.string().min(1),
  memo: z.string().min(1).max(500).transform((s) => s.trim()),
  lines: z.array(lineSchema).min(2).max(200),
  source: z
    .enum(["MANUAL", "VOUCHER", "INVOICE", "PAYMENT", "DEPRECIATION", "SYSTEM"])
    .optional(),
  sourceId: z.string().max(200).optional().nullable(),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const parsed = parseOr400(postJournalSchema, body);
    if (!parsed.ok) return parsed.response;

    const data = parsed.data;
    const clientId = data.clientId ? String(data.clientId).trim() : null;

    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
      }
    }

    await ensureChartOfAccounts();

    const entry = await postJournalEntry({
      date: data.date,
      memo: data.memo,
      lines: data.lines.map((l) => ({
        accountId: l.accountId,
        accountCode: l.accountCode,
        debit: l.debit,
        credit: l.credit,
        reference: l.reference || undefined,
        narration: l.narration || undefined,
      })),
      source: (data.source as any) || "MANUAL",
      sourceId: data.sourceId || undefined,
      createdBy: actor,
      clientId,
    });

    const payload = { success: true, entry };
    if (clientId) await completeIdempotency(clientId, payload);

    await logAudit({
      actor,
      action: "JOURNAL_POSTED",
      entityType: "JournalEntry",
      entityId: entry.id,
      details: `${entry.entryNumber} posted for ${periodForDate(new Date(entry.date))}: ${entry.memo} (${entry.totalDebit.toFixed(2)} debit / ${entry.totalCredit.toFixed(2)} credit)`,
    });

    return NextResponse.json(payload);
  } catch (error: any) {
    if (error instanceof GlError) {
      const status = error.code === "DUPLICATE" ? 200 : 400;
      return NextResponse.json(
        {
          success: error.code === "DUPLICATE",
          duplicate: error.code === "DUPLICATE",
          error: error.message,
          code: error.code,
        },
        { status },
      );
    }
    console.error("POST /api/finance/journals error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}