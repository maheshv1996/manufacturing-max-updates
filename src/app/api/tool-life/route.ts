import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function deriveLife(tool: any) {
  const pct =
    tool.ratedLifeUnits > 0
      ? Math.min(100, (tool.usedUnits / tool.ratedLifeUnits) * 100)
      : 0;
  const regrindsLeft = Math.max(0, tool.maxRegrinds - tool.regrinds);
  return {
    pct: Math.round(pct * 10) / 10,
    regrindsLeft,
    exhausted: pct >= 100,
  };
}

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (
      !user ||
      (!user.isOwner &&
        !can(user, "ops.view") &&
        !can(user, "maintenance.view"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [tools, logs, openWos] = await Promise.all([
      prisma.maintenanceTool.findMany({
        include: { machine: { select: { name: true } } },
        orderBy: { code: "asc" },
      }),
      prisma.toolLifeLog.findMany({
        include: { tool: { select: { code: true } } },
        orderBy: { at: "desc" },
        take: 40,
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        select: {
          id: true,
          woNumber: true,
          product: { select: { name: true } },
        },
        orderBy: { priority: "asc" },
        take: 50,
      }),
    ]);

    const board = tools.map((t) => ({
      ...t,
      life: deriveLife(t),
      status: t.lifeStatus,
      // if life exhausted (or flagged NEEDS_REGRIND) and regrinds left and not scrapped → needs regrind
      effective:
        t.lifeStatus === "SCRAPPED"
          ? "SCRAPPED"
          : t.lifeStatus === "NEEDS_REGRIND" || deriveLife(t).exhausted
            ? t.regrinds < t.maxRegrinds
              ? "NEEDS_REGRIND"
              : "SCRAPPED"
            : t.lifeStatus === "IN_USE"
              ? "IN_USE"
              : "AVAILABLE",
    }));

    return NextResponse.json({
      tools: board,
      logs,
      openWos,
      stats: {
        total: tools.length,
        available: board.filter((t) => t.effective === "AVAILABLE").length,
        inUse: board.filter((t) => t.effective === "IN_USE").length,
        needsRegrind: board.filter((t) => t.effective === "NEEDS_REGRIND")
          .length,
        scrapped: board.filter((t) => t.effective === "SCRAPPED").length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/tool-life error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Admin";
    const user = getUserFromHeaders(headerList);
    if (
      !user.isOwner &&
      !can(user, "ops.edit") &&
      !can(user, "maintenance.edit")
    ) {
      return NextResponse.json(
        { error: "Insufficient role: ops/maintenance edit required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { action, toolId, woNumber, woId, costRupees, units, note } = body;
    if (!toolId)
      return NextResponse.json({ error: "toolId required" }, { status: 400 });

    const tool = await prisma.maintenanceTool.findUnique({
      where: { id: toolId },
    });
    if (!tool)
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });

    if (action === "issue") {
      if (tool.lifeStatus === "SCRAPPED")
        return NextResponse.json(
          { error: "TOOL_SCRAPPED: tool is scrapped — cannot issue" },
          { status: 400 },
        );
      if (
        tool.regrinds >= tool.maxRegrinds &&
        tool.usedUnits >= tool.ratedLifeUnits
      ) {
        return NextResponse.json(
          {
            error:
              "TOOL_MAXED: tool reached max regrinds — it must be scrapped, not issued",
          },
          { status: 400 },
        );
      }
      if (!woNumber)
        return NextResponse.json(
          { error: "woNumber required for issue (posts to job costing)" },
          { status: 400 },
        );
      const cost = Number(costRupees || 0);
      const updated = await prisma.maintenanceTool.update({
        where: { id: toolId },
        data: { lifeStatus: "IN_USE", lastChangedAt: new Date() },
      });
      await prisma.toolLifeLog.create({
        data: {
          toolId,
          action: "ISSUE",
          woNumber,
          woId: woId || null,
          costRupees: cost,
          actor,
          note: note || null,
        },
      });
      if (cost > 0) {
        await prisma.workOrder.updateMany({
          where: { woNumber },
          data: { toolingCostRupees: { increment: cost } },
        });
      }
      await logAudit({
        actor,
        action: "TOOL_ISSUED",
        entityType: "TOOL",
        entityId: toolId,
        details: `Issued ${tool.code} to ${woNumber}${cost > 0 ? ` — ₹${cost} posted to job costing` : ""}`,
      });
      return NextResponse.json({ tool: updated });
    }

    if (action === "record-use") {
      if (tool.lifeStatus === "SCRAPPED")
        return NextResponse.json(
          { error: "Tool is scrapped" },
          { status: 400 },
        );
      const u = Number(units || 0);
      const newUsed = tool.usedUnits + u;
      const exhausted = newUsed >= tool.ratedLifeUnits;
      const maxed = tool.regrinds >= tool.maxRegrinds;
      const lifeStatus = exhausted
        ? maxed
          ? "SCRAPPED"
          : "NEEDS_REGRIND"
        : tool.lifeStatus;
      const updated = await prisma.maintenanceTool.update({
        where: { id: toolId },
        data: { usedUnits: newUsed, lifeStatus, lastChangedAt: new Date() },
      });
      await prisma.toolLifeLog.create({
        data: {
          toolId,
          action: exhausted ? (maxed ? "SCRAP" : "NEEDS_REGRIND") : "USE",
          actor,
          note: `${u} units used`,
        },
      });
      return NextResponse.json({
        tool: { ...updated, life: deriveLife(updated) },
        status: lifeStatus,
      });
    }

    if (action === "regrind") {
      if (tool.lifeStatus === "SCRAPPED")
        return NextResponse.json(
          { error: "Tool is scrapped — cannot regrind" },
          { status: 400 },
        );
      if (tool.regrinds >= tool.maxRegrinds)
        return NextResponse.json(
          {
            error: `MAX_REGRINDS: tool has ${tool.regrinds}/${tool.maxRegrinds} regrinds — it must be scrapped`,
          },
          { status: 400 },
        );
      const updated = await prisma.maintenanceTool.update({
        where: { id: toolId },
        data: {
          regrinds: { increment: 1 },
          usedUnits: 0,
          lifeStatus: "AVAILABLE",
          lastChangedAt: new Date(),
        },
      });
      await prisma.toolLifeLog.create({
        data: { toolId, action: "REGRIND", actor, note: note || null },
      });
      await logAudit({
        actor,
        action: "TOOL_REGROUND",
        entityType: "TOOL",
        entityId: toolId,
        details: `Reground ${tool.code} (${updated.regrinds}/${updated.maxRegrinds})`,
      });
      return NextResponse.json({
        tool: { ...updated, life: deriveLife(updated) },
      });
    }

    if (action === "scrap") {
      const updated = await prisma.maintenanceTool.update({
        where: { id: toolId },
        data: { lifeStatus: "SCRAPPED", lastChangedAt: new Date() },
      });
      await prisma.toolLifeLog.create({
        data: { toolId, action: "SCRAP", actor, note: note || null },
      });
      await logAudit({
        actor,
        action: "TOOL_SCRAPPED",
        entityType: "TOOL",
        entityId: toolId,
        details: `Scrapped ${tool.code} — ${note || "end of life"}`,
      });
      return NextResponse.json({
        tool: { ...updated, life: deriveLife(updated) },
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("POST /api/tool-life error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
