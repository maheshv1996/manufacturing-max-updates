import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { advanceEightDTx } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eightDId: z.string().trim().min(1),
  evidence: z
    .object({
      containmentRecorded: z.boolean().optional(),
      d4RootCause: z.string().trim().min(1).optional(),
      d5Corrective: z.string().trim().min(1).optional(),
      d6Preventive: z.string().trim().min(1).optional(),
      d7Verification: z.string().trim().min(1).optional(),
    })
    .default({}),
  // Quality-manager review — required to enter CLOSED (G-3 review).
  reviewed: z.boolean().optional(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — advance an 8D stage (quality.edit; reviewed requires quality.approve). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    if (a.reviewed && !can(user, "quality.approve")) {
      throw forbidden("quality.approve required for 8D closure review");
    }

    const result = await advanceEightDTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      eightDId: a.eightDId,
      evidence: a.evidence,
      reviewed: a.reviewed,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Advance already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, eightD: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}