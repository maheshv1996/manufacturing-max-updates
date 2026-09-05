import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionEcoTx } from "@/lib/change/changeTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ecoId: z.string().trim().min(1),
  action: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("APPROVE"),
      effectivityType: z.enum(["DATE", "SERIAL"]),
      // G-5: recorded effectivity — validated by the engine (ISO date / N | N+ | A..B).
      effectivityValue: z.string().trim().min(1).max(64),
    }),
    z.object({ action: z.literal("REJECT"), note: z.string().trim().min(1).max(2000) }),
    z.object({ action: z.literal("IMPLEMENT"), note: z.string().trim().min(1).max(2000).optional() }),
  ]),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — advance an ECO (REJECT: engineering.edit; APPROVE/IMPLEMENT: engineering.approve). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "engineering.edit")) throw forbidden("engineering.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    if (a.action.action !== "REJECT" && !can(user, "engineering.approve")) {
      throw forbidden("engineering.approve required");
    }

    const result = await transitionEcoTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      ecoId: a.ecoId,
      action: a.action,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, eco: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}