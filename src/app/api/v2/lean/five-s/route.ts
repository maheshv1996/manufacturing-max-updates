import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { recordFiveSAuditTx } from "@/lib/lean/leanTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  area: z.string().trim().min(1).max(100),
  auditorName: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(1000).optional().nullable(),
  scores: z
    .array(
      z.object({
        itemId: z.string().trim().min(1),
        score: z.number().int().min(0).max(5),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "projects.edit")) throw forbidden("projects.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const audit = await recordFiveSAuditTx(
      prisma,
      { id: user.id, name: user.name },
      parsed.value,
    );
    return NextResponse.json({ success: true, audit }, { status: 201 });
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
    if (!user.id || !can(user, "projects.view")) throw forbidden("projects.view required");

    const url = new URL(req.url);
    const area = url.searchParams.get("area");

    const audits = await prisma.fiveSAudit.findMany({
      where: area ? { area } : {},
      include: {
        scores: {
          include: { item: true },
        },
      },
      orderBy: { date: "desc" },
      take: 100,
    });
    return NextResponse.json({ success: true, audits });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
