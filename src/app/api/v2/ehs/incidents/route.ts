import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { reportIncidentTx } from "@/lib/ehs/ehsTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.enum(["NEAR_MISS", "HAZARD", "PPE_VIOLATION", "INCIDENT"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  location: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  machineId: z.string().trim().min(1).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "ehs.edit")) throw forbidden("ehs.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const incident = await reportIncidentTx(
      prisma,
      { id: user.id, name: user.name },
      parsed.value,
    );
    return NextResponse.json({ success: true, incident }, { status: 201 });
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
    if (!user.id || !can(user, "ehs.view")) throw forbidden("ehs.view required");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const severity = url.searchParams.get("severity");

    const incidents = await prisma.safetyIncident.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(severity ? { severity } : {}),
      },
      orderBy: { reportedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ success: true, incidents });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
