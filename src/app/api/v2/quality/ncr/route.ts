import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createNcr } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const createNcrSchema = z.object({
  ncrNumber: z.string().trim().min(1).max(64),
  quarantineId: z.string().trim().min(1).optional(),
  workOrderId: z.string().trim().min(1).optional(),
  productId: z.string().trim().min(1).optional(),
  quantity: z.number().positive(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  description: z.string().trim().min(1).max(2000),
  raisedBy: z.string().trim().min(1).max(128),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — create an NCR from a non-conformance (quality.edit). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createNcrSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await createNcr(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      ncrNumber: a.ncrNumber,
      quarantineId: a.quarantineId,
      workOrderId: a.workOrderId,
      productId: a.productId,
      quantity: a.quantity,
      severity: a.severity,
      description: a.description,
      raisedBy: a.raisedBy,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "NCR already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, ncr: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}