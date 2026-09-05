import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { maintenanceToolActionTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONSUME"), units: z.number().positive(), woNumber: z.string().trim().max(64).optional() }),
  z.object({ action: z.literal("REGRIND"), costRupees: z.number().nonnegative().optional() }),
  z.object({ action: z.literal("SCRAP"), reason: z.string().trim().min(1).max(1000) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.edit")) throw forbidden("maintenance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const result = await maintenanceToolActionTx(prisma, { id: user.id, name: user.name }, id, parsed.value);
    return NextResponse.json({ success: true, tool: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}