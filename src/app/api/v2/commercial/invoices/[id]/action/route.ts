import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionInvoiceTx } from "@/lib/commercial/commercialTx";
import type { InvoiceAction } from "@/lib/commercial/invoices";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SEND") }),
  z.object({ action: z.literal("MARK_PAID") }),
  z.object({ action: z.literal("MARK_PARTIAL"), amount: z.number().positive() }),
  z.object({ action: z.literal("APPLY_PAYMENT"), amount: z.number().positive() }),
  z.object({ action: z.literal("MARK_OVERDUE") }),
]);

const bodySchema = z.object({
  invoiceId: z.string().trim().min(1),
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

    const amount = a.action.action === "APPLY_PAYMENT" || a.action.action === "MARK_PARTIAL" ? a.action.amount : undefined;
    const result = await transitionInvoiceTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      invoiceId: a.invoiceId,
      action: a.action as InvoiceAction,
      amount,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, invoice: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
