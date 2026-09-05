import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { scanBreakdownsTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["SCAN", "SCAN_AND_CREATE"]),
  cooldownMinutes: z.number().int().nonnegative().optional(),
});

/**
 * POST — machine FAULT/Andon → BREAKDOWN MaintenanceJob. SCAN reports the
 * candidates without writing; SCAN_AND_CREATE auto-creates one BREAKDOWN job per
 * FAULT machine with no open breakdown (W11). Open jobs suppress duplicates.
 */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.edit")) throw forbidden("maintenance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const result = await scanBreakdownsTx(prisma, { id: user.id, name: user.name }, {
      createJobs: parsed.value.mode === "SCAN_AND_CREATE",
      cooldownMinutes: parsed.value.cooldownMinutes,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}