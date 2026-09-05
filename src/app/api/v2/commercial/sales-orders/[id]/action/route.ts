import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionSalesOrderTx } from "@/lib/commercial/commercialTx";
import type { SalesOrderAction } from "@/lib/commercial/salesOrders";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONFIRM") }),
  z.object({ action: z.literal("START_PROGRESS") }),
  z.object({ action: z.literal("COMPLETE") }),
  z.object({ action: z.literal("CANCEL") }),
]);

const bodySchema = z.object({
  salesOrderId: z.string().trim().min(1),
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

    const result = await transitionSalesOrderTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      salesOrderId: a.salesOrderId,
      action: a.action as SalesOrderAction,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, salesOrder: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
