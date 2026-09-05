import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createPmRuleTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    machineId: z.string().trim().min(1),
    title: z.string().trim().min(3).max(200),
    intervalDays: z.number().int().positive().optional(),
    intervalRunHours: z.number().positive().optional(),
    kitId: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.intervalDays || v.intervalRunHours, { message: "intervalDays or intervalRunHours required" });

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.edit")) throw forbidden("maintenance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const rule = await createPmRuleTx(prisma, { id: user.id, name: user.name }, parsed.value);
    return NextResponse.json({ success: true, rule }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.view")) throw forbidden("maintenance.view required");

    const rules = await prisma.pMRule.findMany({ orderBy: { title: "asc" }, take: 500 });
    return NextResponse.json({ success: true, rules });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
