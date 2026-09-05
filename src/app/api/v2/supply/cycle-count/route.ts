import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createCycleCountSessionTx } from "@/lib/supply/supplyTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  abcClass: z.enum(["A", "B", "C"]),
  lines: z.array(z.object({ rawMaterialId: z.string().trim().min(1), systemQty: z.number().nonnegative() })).min(1),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — start a cycle-count session (W12; supply.edit). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "supply.edit")) throw forbidden("supply.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await createCycleCountSessionTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      name: a.name,
      abcClass: a.abcClass,
      lines: a.lines,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Session already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, session: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}