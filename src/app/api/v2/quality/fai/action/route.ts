import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionFaiTx } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  faiId: z.string().trim().min(1),
  action: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("SUBMIT"),
      // charNos whose FAIL carries an approved deviation justification.
      justifiedCharNos: z.array(z.string().trim().min(1)).optional(),
    }),
    z.object({ action: z.literal("DECIDE"), approve: z.boolean() }),
  ]),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — advance an FAI (SUBMIT: quality.edit; DECIDE: quality.approve). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    if (a.action.action === "DECIDE" && !can(user, "quality.approve")) {
      throw forbidden("quality.approve required for FAI decision");
    }

    const result = await transitionFaiTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      faiId: a.faiId,
      action: a.action,
      justifiedCharNos: a.action.action === "SUBMIT" ? a.action.justifiedCharNos : undefined,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, fai: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}