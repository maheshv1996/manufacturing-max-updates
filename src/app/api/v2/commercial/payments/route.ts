import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createPayment } from "@/lib/commercial/commercialTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  invoiceId: z.string().trim().min(1),
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER", "RAZORPAY"]),
  reference: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(2000).optional(),
  receivedBy: z.string().trim().min(1).max(128),
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

    const result = await createPayment(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      invoiceId: a.invoiceId,
      amount: a.amount,
      method: a.method,
      reference: a.reference,
      notes: a.notes,
      receivedBy: a.receivedBy,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Payment already recorded (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, payment: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
