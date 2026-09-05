import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createInspectionTx } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  workOrderId: z.string().trim().min(1),
  inspectorId: z.string().trim().min(1).optional().nullable(),
  totalInspected: z.number().int().positive(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  defectCodeId: z.string().trim().min(1).optional().nullable(),
  calibratedToolId: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/**
 * POST — record a QualityInspection. The measurement instrument (when supplied)
 * is G-4 gated at the adapter: an expired/retired/quarantined gauge can never
 * record a result.
 */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const created = await createInspectionTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: parsed.value.clientId,
      workOrderId: parsed.value.workOrderId,
      inspectorId: parsed.value.inspectorId ?? undefined,
      totalInspected: parsed.value.totalInspected,
      passed: parsed.value.passed,
      failed: parsed.value.failed,
      defectCodeId: parsed.value.defectCodeId ?? undefined,
      calibratedToolId: parsed.value.calibratedToolId ?? undefined,
      notes: parsed.value.notes ?? undefined,
    });
    return NextResponse.json({ success: true, inspection: created }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}