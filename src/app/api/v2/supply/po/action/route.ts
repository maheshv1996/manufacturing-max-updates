import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { advancePoApprovalTx } from "@/lib/supply/supplyTx";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ESCALATE"), tier: z.enum(["MANAGER", "OWNER"]) }),
  z.object({ action: z.literal("APPROVE"), tier: z.enum(["MANAGER", "OWNER"]), ownerStillRequired: z.boolean().optional() }),
  z.object({ action: z.literal("REJECT"), reason: z.string().trim().min(1).max(2000) }),
]);

const bodySchema = z.object({
  poId: z.string().trim().min(1),
  action: actionSchema,
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — advance the PO approval ladder (supply.approve). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "supply.approve")) throw forbidden("supply.approve required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await advancePoApprovalTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      poId: a.poId,
      action: a.action,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Approval already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, po: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}