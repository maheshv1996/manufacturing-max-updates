import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createQuotation } from "@/lib/commercial/commercialTx";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  productId: z.string().trim().min(1),
  plannedQty: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

const bodySchema = z.object({
  quoteNumber: z.string().trim().min(1).max(64),
  customerName: z.string().trim().min(1).max(200),
  customerContact: z.string().trim().max(200).optional(),
  validUntil: z.string().trim().optional(),
  estimatedCost: z.number().nonnegative(),
  quotedPrice: z.number().nonnegative(),
  notes: z.string().trim().max(2000).optional(),
  workOrderId: z.string().trim().optional(),
  lines: z.array(lineSchema).min(1),
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

    const result = await createQuotation(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      quoteNumber: a.quoteNumber,
      customerName: a.customerName,
      customerContact: a.customerContact,
      validUntil: a.validUntil ? new Date(a.validUntil) : undefined,
      estimatedCost: a.estimatedCost,
      quotedPrice: a.quotedPrice,
      notes: a.notes,
      workOrderId: a.workOrderId,
      lines: a.lines,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Quotation already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, quotation: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
