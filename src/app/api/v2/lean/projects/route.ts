import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createProjectTx } from "@/lib/lean/leanTx";
import type { ProjectType, ProjectPhase, ProjectStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  ownerName: z.string().trim().min(1).max(100),
  type: z.enum(["KAIZEN", "DMAIC"]),
  description: z.string().trim().max(2000).optional().nullable(),
  machineId: z.string().trim().min(1).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "projects.edit")) throw forbidden("projects.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const project = await createProjectTx(
      prisma,
      { id: user.id, name: user.name },
      parsed.value,
    );
    return NextResponse.json({ success: true, project }, { status: 201 });
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
    const type = url.searchParams.get("type");
    const phase = url.searchParams.get("phase");
    const status = url.searchParams.get("status");

    const projects = await prisma.improvementProject.findMany({
      where: {
        ...(type ? { type: type as ProjectType } : {}),
        ...(phase ? { phase: phase as ProjectPhase } : {}),
        ...(status ? { status: status as ProjectStatus } : {}),
      },
      include: {
        rcaRecord: true,
        actionItems: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ success: true, projects });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
