import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { mutateDataPackageTx } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const mutateSchema = z.object({
  packageId: z.string().trim().min(1),
  // G-6: RELEASED packages need an explicit new revision to change.
  newRevision: z.boolean().optional(),
  snapshot: z.unknown().optional(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — update a package (quality.edit; newRevision requires quality.approve). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(mutateSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    if (a.newRevision && !can(user, "quality.approve")) {
      throw forbidden("quality.approve required to revise a released package");
    }

    const result = await mutateDataPackageTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      packageId: a.packageId,
      newRevision: a.newRevision,
      snapshot: a.snapshot,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Mutation already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, dataPackage: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}