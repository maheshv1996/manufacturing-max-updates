import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionQuotationTx } from "@/lib/commercial/commercialTx";
import type { QuotationAction } from "@/lib/commercial/quotations";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SEND") }),
  z.object({ action: z.literal("MARK_WON") }),
  z.object({ action: z.literal("MARK_LOST") }),
  z.object({ action: z.literal("CONVERT"), salesOrderId: z.string().trim().optional() }),
]);

const bodySchema = z.object({
  quotationId: z.string().trim().min(1),
  action: actionSchema,
  clientId: z.string().trim().min(1).max(128).optional(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "commercial.edit")) throw forbidden("commercial.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await transitionQuotationTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      quotationId: a.quotationId,
      action: a.action as QuotationAction,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, quotation: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
