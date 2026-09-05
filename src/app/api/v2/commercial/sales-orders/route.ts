import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createSalesOrder } from "@/lib/commercial/commercialTx";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  productId: z.string().trim().optional(),
  productCode: z.string().trim().optional(),
  productName: z.string().trim().min(1).max(200),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional(),
});

const bodySchema = z.object({
  orderNumber: z.string().trim().min(1).max(64),
  customerId: z.string().trim().min(1),
  customerName: z.string().trim().min(1).max(200),
  expectedDelivery: z.string().trim().optional(),
  poReference: z.string().trim().max(128).optional(),
  paymentTerms: z.string().trim().max(200).optional(),
  currency: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(2000).optional(),
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

    const result = await createSalesOrder(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      orderNumber: a.orderNumber,
      customerId: a.customerId,
      customerName: a.customerName,
      expectedDelivery: a.expectedDelivery ? new Date(a.expectedDelivery) : undefined,
      poReference: a.poReference,
      paymentTerms: a.paymentTerms,
      currency: a.currency,
      notes: a.notes,
      lines: a.lines,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Sales order already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, salesOrder: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
