import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { nextSequenceTx } from "@/lib/sequence";
import { createPermitTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  maintenanceJobId: z.string().trim().min(1),
  type: z.enum(["HOT_WORK", "HEIGHT_WORK", "CONFINED_SPACE", "ELECTRICAL", "EXCAVATION"]),
  description: z.string().trim().min(3).max(2000),
  location: z.string().trim().min(1).max(300),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.edit")) throw forbidden("maintenance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const permitNo = await prisma.$transaction((tx) => nextSequenceTx(tx as never, "PTW", 4));
    const permit = await createPermitTx(prisma, { id: user.id, name: user.name }, permitNo, {
      maintenanceJobId: parsed.value.maintenanceJobId,
      type: parsed.value.type,
      description: parsed.value.description,
      location: parsed.value.location,
      validFrom: new Date(parsed.value.validFrom),
      validUntil: new Date(parsed.value.validUntil),
    });
    return NextResponse.json({ success: true, permit }, { status: 201 });
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

    const permits = await prisma.permitToWork.findMany({ orderBy: { requestedAt: "desc" }, take: 200 });
    return NextResponse.json({ success: true, permits });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}