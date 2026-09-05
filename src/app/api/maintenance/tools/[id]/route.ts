import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit", "quality.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, code, name, machineId, kind, ratedLifeUnits } = body;
    const actor = user.name || headerList.get("x-user-name") || "Admin";

    const tool = await (prisma as any).maintenanceTool.findUnique({
      where: { id },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (action === "RESET") {
      const updated = await prisma.$transaction(async (tx) => {
        const res = await (tx as any).maintenanceTool.update({
          where: { id },
          data: {
            usedUnits: 0,
            lastChangedAt: new Date(),
          },
          include: { machine: { select: { id: true, name: true, code: true } } },
        });

        await logAuditTx(tx, {
          actor,
          action: "TOOL_COUNTER_RESET",
          entityType: "MAINTENANCE_TOOL",
          entityId: id,
          details: `Reset tool counter for ${tool.code} — tool changed at ${new Date().toLocaleDateString()}`,
        });
        return res;
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
    const updated = await prisma.$transaction(async (tx) => {
      const res = await (tx as any).maintenanceTool.update({
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

      await logAuditTx(tx, {
        actor,
        action: "MAINTENANCE_TOOL_EDIT",
        entityType: "MAINTENANCE_TOOL",
        entityId: id,
        details: `Edited maintenance tool ${res.code}`,
      });
      return res;
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
