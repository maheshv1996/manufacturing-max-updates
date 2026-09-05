import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createFai } from "@/lib/quality/qualityTx";

export const dynamic = "force-dynamic";

const createFaiSchema = z.object({
  faiNumber: z.string().trim().min(1).max(64),
  workOrderId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  drawingRevision: z.string().trim().min(1).optional(),
  preparedBy: z.string().trim().min(1).max(128),
  characteristics: z
    .array(
      z.object({
        charNo: z.string().trim().min(1).max(32),
        description: z.string().trim().min(1).max(500),
        target: z.number().optional().nullable(),
        lsl: z.number().optional().nullable(),
        usl: z.number().optional().nullable(),
        actual: z.number().optional().nullable(),
        pass: z.boolean(),
      }),
    )
    .min(1),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — create an FAI report with characteristics (quality.edit). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "quality.edit")) throw forbidden("quality.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createFaiSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await createFai(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      faiNumber: a.faiNumber,
      workOrderId: a.workOrderId,
      productId: a.productId,
      drawingRevision: a.drawingRevision,
      preparedBy: a.preparedBy,
      characteristics: a.characteristics,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "FAI already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, fai: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}