import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionPaymentTx } from "@/lib/commercial/commercialTx";
import type { PaymentAction } from "@/lib/commercial/payments";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CLEAR"), clearedAt: z.string().datetime().optional() }),
  z.object({ action: z.literal("BOUNCE"), reason: z.string().trim().min(1).max(1000) }),
]);

const bodySchema = z.object({
  paymentId: z.string().trim().min(1),
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

    const action: PaymentAction = a.action.action === "CLEAR"
      ? { action: "CLEAR", clearedAt: new Date(a.action.clearedAt || Date.now()) }
      : { action: "BOUNCE", reason: a.action.reason };

    const result = await transitionPaymentTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      paymentId: a.paymentId,
      action,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, payment: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
