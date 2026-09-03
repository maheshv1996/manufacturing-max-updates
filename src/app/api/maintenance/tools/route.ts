import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

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

    const tool = await (prisma as any).maintenanceTool.create({
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

    const headerList = await headers();
    await logAudit({
      actor: headerList.get("x-user-name") || "Admin",
      action: "MAINTENANCE_TOOL_CREATE",
      entityType: "MAINTENANCE_TOOL",
      entityId: tool.id,
      details: `Created maintenance tool ${code} (${kind}), rated ${ratedLifeUnits} units`,
    });

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
