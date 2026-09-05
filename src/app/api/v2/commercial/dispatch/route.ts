import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createDispatch } from "@/lib/commercial/commercialTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  challanNumber: z.string().trim().min(1).max(64),
  workOrderId: z.string().trim().min(1),
  dispatchedQty: z.number().int().positive(),
  carrierName: z.string().trim().max(128).optional(),
  vehicleNumber: z.string().trim().max(32).optional(),
  driverName: z.string().trim().max(128).optional(),
  ewayBillNo: z.string().trim().max(64).optional(),
  gatePassNumber: z.string().trim().max(64).optional(),
  securityCheckedBy: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(2000).optional(),
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

    const result = await createDispatch(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      challanNumber: a.challanNumber,
      workOrderId: a.workOrderId,
      dispatchedQty: a.dispatchedQty,
      carrierName: a.carrierName,
      vehicleNumber: a.vehicleNumber,
      driverName: a.driverName,
      ewayBillNo: a.ewayBillNo,
      gatePassNumber: a.gatePassNumber,
      securityCheckedBy: a.securityCheckedBy,
      notes: a.notes,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Dispatch already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, dispatch: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
