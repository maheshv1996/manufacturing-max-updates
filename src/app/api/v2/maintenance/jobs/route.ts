import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createJob } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  machineId: z.string().trim().min(1),
  type: z.enum(["BREAKDOWN", "PM"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  description: z.string().trim().min(3).max(2000),
  kitId: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.edit")) throw forbidden("maintenance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const job = await createJob(prisma, { id: user.id, name: user.name }, parsed.value);
    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.view")) throw forbidden("maintenance.view required");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const jobs = await prisma.maintenanceJob.findMany({
      where: status ? { status: status as "OPEN" | "IN_PROGRESS" | "CLOSED" } : {},
      orderBy: { openedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ success: true, jobs });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
