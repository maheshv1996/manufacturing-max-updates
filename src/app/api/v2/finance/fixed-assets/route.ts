import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { bookDepreciationTx } from "@/lib/finance/financeTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assetId: z.string().trim().min(1),
  period: z.string().trim().regex(/^\d{4}-\d{2}$/),
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

    const result = await bookDepreciationTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      assetId: a.assetId,
      period: a.period,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Depreciation already booked (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, depreciation: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
