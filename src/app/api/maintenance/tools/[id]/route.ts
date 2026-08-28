import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, code, name, machineId, kind, ratedLifeUnits } = body;

    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Admin";

    const tool = await (prisma as any).maintenanceTool.findUnique({
      where: { id },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (action === "RESET") {
      const updated = await (prisma as any).maintenanceTool.update({
        where: { id },
        data: {
          usedUnits: 0,
          lastChangedAt: new Date(),
        },
        include: { machine: { select: { id: true, name: true, code: true } } },
      });

      await logAudit({
        actor,
        action: "TOOL_COUNTER_RESET",
        entityType: "MAINTENANCE_TOOL",
        entityId: id,
        details: `Reset tool counter for ${tool.code} — tool changed at ${new Date().toLocaleDateString()}`,
      });

      const lifePct =
        updated.ratedLifeUnits > 0
          ? (updated.usedUnits / updated.ratedLifeUnits) * 100
          : 0;
      return NextResponse.json({
        tool: {
          ...updated,
          lifePct: Number(lifePct.toFixed(1)),
          toolStatus: "OK",
        },
      });
    }

    // Edit mode
    const updated = await (prisma as any).maintenanceTool.update({
      where: { id },
      data: {
        code: code || tool.code,
        name: name !== undefined ? name : tool.name,
        machineId: machineId !== undefined ? machineId : tool.machineId,
        kind: kind || tool.kind,
        ratedLifeUnits: ratedLifeUnits
          ? Number(ratedLifeUnits)
          : tool.ratedLifeUnits,
      },
      include: { machine: { select: { id: true, name: true, code: true } } },
    });

    await logAudit({
      actor,
      action: "MAINTENANCE_TOOL_EDIT",
      entityType: "MAINTENANCE_TOOL",
      entityId: id,
      details: `Edited maintenance tool ${updated.code}`,
    });

    const lifePct =
      updated.ratedLifeUnits > 0
        ? (updated.usedUnits / updated.ratedLifeUnits) * 100
        : 0;
    let toolStatus: "OK" | "WARN" | "REPLACE" = "OK";
    if (lifePct >= 100) toolStatus = "REPLACE";
    else if (lifePct >= 90) toolStatus = "WARN";

    return NextResponse.json({
      tool: { ...updated, lifePct: Number(lifePct.toFixed(1)), toolStatus },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
