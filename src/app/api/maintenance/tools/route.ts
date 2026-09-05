import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tools = await (prisma as any).maintenanceTool.findMany({
      include: {
        machine: { select: { id: true, name: true, code: true } },
      },
      orderBy: { code: "asc" },
    });

    const enriched = tools.map((t: any) => {
      const lifePct =
        t.ratedLifeUnits > 0 ? (t.usedUnits / t.ratedLifeUnits) * 100 : 0;
      let toolStatus: "OK" | "WARN" | "REPLACE" = "OK";
      if (lifePct >= 100) toolStatus = "REPLACE";
      else if (lifePct >= 90) toolStatus = "WARN";
      return { ...t, lifePct: Number(lifePct.toFixed(1)), toolStatus };
    });

    return NextResponse.json({ tools: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit", "quality.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { code, name, machineId, kind, ratedLifeUnits } = body;

    if (!code || !kind || !ratedLifeUnits) {
      return NextResponse.json(
        { error: "code, kind and ratedLifeUnits are required" },
        { status: 400 },
      );
    }

    const actor = user.name || headerList.get("x-user-name") || "Admin";

    const tool = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).maintenanceTool.create({
        data: {
          code,
          name: name || null,
          machineId: machineId || null,
          kind,
          ratedLifeUnits: Number(ratedLifeUnits),
          usedUnits: 0,
        },
        include: { machine: { select: { id: true, name: true, code: true } } },
      });

      await logAuditTx(tx, {
        actor,
        action: "MAINTENANCE_TOOL_CREATE",
        entityType: "MAINTENANCE_TOOL",
        entityId: created.id,
        details: `Created maintenance tool ${code} (${kind}), rated ${ratedLifeUnits} units`,
      });

      return created;
    });

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
