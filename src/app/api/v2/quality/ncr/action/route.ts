import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionNcrTx } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START_REVIEW") }),
  z.object({
    action: z.literal("DISPOSE"),
    disposition: z.enum(["USE_AS_IS", "REWORK", "SCRAP", "RETURN_TO_SUPPLIER"]),
    authority: z.enum(["QUALITY", "ENGINEERING", "CUSTOMER"]),
    justification: z.string().trim().min(1).max(2000),
    // Org-config: does the contract require customer concession for USE_AS_IS?
    // Wired to org settings with the org-config cycle (C12); false today.
    contractRequiresCustomerConcession: z.boolean().optional(),
  }),
  z.object({ action: z.literal("CLOSE"), closeNote: z.string().trim().min(1).max(2000) }),
]);

const bodySchema = z.object({
  ncrId: z.string().trim().min(1),
  action: actionSchema,
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — advance an NCR (START_REVIEW/CLOSE: quality.edit; DISPOSE: quality.approve). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    if (a.action.action === "DISPOSE" && !can(user, "quality.approve")) {
      throw forbidden("quality.approve required for disposition");
    }

    const result = await transitionNcrTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      ncrId: a.ncrId,
      action: a.action,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, ncr: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}