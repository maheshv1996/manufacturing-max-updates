import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { reconcileBankTx } from "@/lib/finance/financeTx";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  date: z.string().trim().min(1),
  description: z.string().trim().min(1).max(500),
  amount: z.number(),
  reference: z.string().trim().max(128).optional(),
});

const bodySchema = z.object({
  bankAccountId: z.string().trim().min(1),
  statement: z.array(lineSchema).min(1),
  book: z.array(lineSchema).min(1),
  tolerancePaise: z.number().nonnegative().optional(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "finance.approve")) throw forbidden("finance.approve required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await reconcileBankTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      bankAccountId: a.bankAccountId,
      statement: a.statement,
      book: a.book,
      tolerancePaise: a.tolerancePaise,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Reconciliation already applied (idempotent duplicate ignored)", result: result.result });
    }
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
