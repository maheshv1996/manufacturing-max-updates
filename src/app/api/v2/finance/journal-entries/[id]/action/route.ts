import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { reverseJournalEntryTx } from "@/lib/finance/financeTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  journalEntryId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(1000),
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

    const result = await reverseJournalEntryTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      journalEntryId: a.journalEntryId,
      reason: a.reason,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Reversal already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, journalEntry: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
