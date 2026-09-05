import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { instrumentActionTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ISSUE"),
    issuedToName: z.string().trim().min(1).max(200),
    expectedReturnAt: z.string().datetime(),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("RETURN"), notes: z.string().trim().max(1000).optional() }),
  z.object({
    action: z.literal("RECALIBRATE"),
    intervalDays: z.number().int().positive(),
    certNumber: z.string().trim().max(100).optional(),
  }),
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

    const action =
      parsed.value.action === "ISSUE"
        ? {
            action: "ISSUE" as const,
            issuedToName: parsed.value.issuedToName,
            expectedReturnAt: new Date(parsed.value.expectedReturnAt),
            notes: parsed.value.notes,
          }
        : parsed.value;
    const result = await instrumentActionTx(prisma, { id: user.id, name: user.name }, id, action);
    return NextResponse.json({ success: true, instrument: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}