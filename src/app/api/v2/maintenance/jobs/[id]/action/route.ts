import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { transitionJobTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START") }),
  z.object({
    action: z.literal("CLOSE"),
    laborHours: z.number().positive().optional(),
    rootCause: z.string().trim().max(2000).optional(),
    countermeasure: z.string().trim().max(2000).optional(),
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
    const a = parsed.value;

    const result = await transitionJobTx(
      prisma,
      { id: user.id, name: user.name },
      id,
      a.action === "START"
        ? { action: "START" }
        : { action: "CLOSE", laborHours: a.laborHours, rootCause: a.rootCause, countermeasure: a.countermeasure },
    );
    return NextResponse.json({ success: true, job: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
