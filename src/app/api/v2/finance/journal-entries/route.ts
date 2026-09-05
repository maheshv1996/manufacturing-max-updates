import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { postJournalEntryTx } from "@/lib/finance/financeTx";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  accountId: z.string().trim().min(1),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: z.number().nonnegative(),
  reference: z.string().trim().max(128).optional(),
  narration: z.string().trim().max(500).optional(),
});

const bodySchema = z.object({
  entryNumber: z.string().trim().min(1).max(64),
  date: z.string().trim().min(1),
  period: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
  memo: z.string().trim().min(1).max(2000),
  source: z.enum(["MANUAL", "VOUCHER", "INVOICE", "PAYMENT", "DEPRECIATION", "SYSTEM"]).default("MANUAL"),
  sourceId: z.string().trim().optional(),
  lines: z.array(lineSchema).min(2),
  clientId: z.string().trim().min(1).max(128).optional(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "finance.edit")) throw forbidden("finance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await postJournalEntryTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      entryNumber: a.entryNumber,
      date: a.date,
      period: a.period,
      memo: a.memo,
      source: a.source,
      sourceId: a.sourceId,
      lines: a.lines,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Journal entry already posted (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, journalEntry: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
