import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { countCycleLineTx } from "@/lib/supply/supplyTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lineId: z.string().trim().min(1),
  countedQty: z.number().nonnegative(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — record a physical count on a cycle-count line (supply.edit). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "supply.edit")) throw forbidden("supply.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await countCycleLineTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      lineId: a.lineId,
      countedQty: a.countedQty,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Count already recorded (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, line: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}