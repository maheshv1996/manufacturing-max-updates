import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { releaseDataPackageTx } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const releaseSchema = z.object({
  packageId: z.string().trim().min(1),
  gates: z.object({
    faiRequired: z.boolean(),
    faiApproved: z.boolean(),
    certsPresent: z.boolean(),
    itemCount: z.number().int().min(0),
  }),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/**
 * POST — release (freeze) a data package (quality.approve). Completeness gates
 * are engine-checked (G-6): FAI required/approved, certs present, non-empty.
 * Gates are assembled by the caller; server-side assembly from the package
 * contents/FAI state joins as the contents builder lands (C3-7 note).
 */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.approve")) throw forbidden("quality.approve required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(releaseSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await releaseDataPackageTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      packageId: a.packageId,
      gates: a.gates,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Release already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, dataPackage: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}