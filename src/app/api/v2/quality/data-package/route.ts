import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createDataPackage } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  packageNumber: z.string().trim().min(1).max(64),
  workOrderId: z.string().trim().min(1),
  snapshot: z.unknown().optional(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — create a DRAFT data package (quality.edit). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await createDataPackage(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      packageNumber: a.packageNumber,
      workOrderId: a.workOrderId,
      snapshot: a.snapshot,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Data package already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, dataPackage: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}