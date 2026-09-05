import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { dispatchChallanTx, PROCESS_TYPES } from "@/lib/supply/supplyTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  workOrderId: z.string().trim().min(1),
  vendorName: z.string().trim().min(1).max(200),
  processType: z.enum(PROCESS_TYPES),
  dispatchedQty: z.number().int().positive(),
  expectedReturn: z.string().trim().optional(),
  vehicleNumber: z.string().trim().max(32).optional(),
  accredited: z.boolean(),
  contractRequiresAccreditation: z.boolean(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — dispatch a subcontract challan (W4; supply.edit). Accredited-scope
 * gated: when the contract requires accreditation, an unaccredited vendor is
 * blocked. */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "supply.edit")) throw forbidden("supply.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await dispatchChallanTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      workOrderId: a.workOrderId,
      vendorName: a.vendorName,
      processType: a.processType,
      dispatchedQty: a.dispatchedQty,
      expectedReturn: a.expectedReturn,
      vehicleNumber: a.vehicleNumber,
      accredited: a.accredited,
      contractRequiresAccreditation: a.contractRequiresAccreditation,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Challan already dispatched (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, challan: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}