import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { reverseJournalEntry, journalEntryToRupees, GlError } from "@/lib/glEngine";
import { checkIdempotency, completeIdempotency } from "@/lib/idempotency";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: { include: { account: { select: { code: true, name: true, type: true } } } },
        reversal: { select: { entryNumber: true, date: true, postedBy: true } },
        reversalOf: { select: { entryNumber: true, date: true } },
      },
    });
    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }
    // Ledger rows are stored as integer paise — expose the rupee contract.
    return NextResponse.json({ success: true, entry: journalEntryToRupees(entry) });
  } catch (error) {
    console.error("GET /api/finance/journals/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const reverseSchema = z.object({
  action: z.literal("reverse"),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(reverseSchema, body);
    if (!parsed.ok) return parsed.response;

    const clientId = parsed.data.clientId ? String(parsed.data.clientId).trim() : null;
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
      }
    }

    const reversal = await reverseJournalEntry(id, actor, clientId);

    const payload = { success: true, reversal };
    if (clientId) await completeIdempotency(clientId, payload);

    await logAudit({
      actor,
      action: "JOURNAL_REVERSED",
      entityType: "JournalEntry",
      entityId: id,
      details: `${reversal.entryNumber} reverses entry ${reversal.memo}`,
      severity: "WARN",
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
    console.error("POST /api/finance/journals/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}