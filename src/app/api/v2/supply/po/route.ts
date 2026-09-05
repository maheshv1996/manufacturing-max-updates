import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createPoTx } from "@/lib/supply/supplyTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  supplierId: z.string().trim().min(1),
  rawMaterialId: z.string().trim().min(1),
  qty: z.number().positive(),
  unitCost: z.number().nonnegative(),
  expectedDate: z.string().trim().optional(),
  overThreshold: z.enum(["MANAGER", "OWNER"]).optional(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — create a purchase order (supply.edit). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "supply.edit")) throw forbidden("supply.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await createPoTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      supplierId: a.supplierId,
      rawMaterialId: a.rawMaterialId,
      qty: a.qty,
      unitCost: a.unitCost,
      expectedDate: a.expectedDate,
      overThreshold: a.overThreshold,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "PO already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, po: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}