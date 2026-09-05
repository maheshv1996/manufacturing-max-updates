import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can, canAny } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { permitActionTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVE_LEG"), leg: z.enum(["EHS", "MAINTENANCE", "PRODUCTION"]), reason: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("VOID"), reason: z.string().trim().min(1).max(1000) }),
]);

// Each approval leg is role-gated at the route: EHS → ehs.approve, maintenance →
// maintenance.edit, production → ops.edit; voiding is safety-critical → either.
const LEG_PERMISSION: Record<"EHS" | "MAINTENANCE" | "PRODUCTION", string> = {
  EHS: "ehs.approve",
  MAINTENANCE: "maintenance.edit",
  PRODUCTION: "ops.edit",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.edit")) throw forbidden("maintenance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    if (a.action === "APPROVE_LEG") {
      if (!can(user, LEG_PERMISSION[a.leg])) throw forbidden(`${LEG_PERMISSION[a.leg]} required for this leg`);
    } else if (!canAny(user, ["maintenance.edit", "ehs.approve"])) {
      throw forbidden("maintenance.edit or ehs.approve required to void");
    }

    const permit = await permitActionTx(prisma, { id: user.id, name: user.name }, params.id, a);
    return NextResponse.json({ success: true, permit });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}