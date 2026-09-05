import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";

export async function GET(_request: Request) {
  try {
    const [prodLogs, dtLogs] = await Promise.all([
      prisma.productionLog.findMany({
        where: { status: "DRAFT" },
        orderBy: { createdAt: "desc" },
        include: {
          machine: true,
          workOrder: { include: { product: true } },
          operator: true,
        },
      }),
      prisma.downtimeLog.findMany({
        where: { status: "DRAFT" },
        orderBy: { createdAt: "desc" },
        include: {
          machine: true,
          reason: true,
          operator: true,
        },
      }),
    ]);

    const combined = [
      ...prodLogs.map((l) => ({ ...l, type: "PRODUCTION" as const })),
      ...dtLogs.map((l) => ({ ...l, type: "DOWNTIME" as const })),
    ];

    combined.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ logs: combined });
  } catch (error: any) {
    console.error("Failed to fetch reconcile logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id || (!user.isOwner && !can(user, "ops.edit") && !can(user, "records.edit") && !can(user, "system.edit"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { logId, type, data } = body;
    const actorName = user.name || headerList.get("x-user-name") || "Supervisor";

    if (!logId || !type || !data) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (type === "PRODUCTION") {
      const log = await prisma.productionLog.findUnique({
        where: { id: logId },
      });
      if (!log)
        return NextResponse.json({ error: "Log not found" }, { status: 404 });

      const history = log.adjustmentHistory
        ? (log.adjustmentHistory as any[])
        : [];
      const reasonText = data.adjustmentReason
        ? `, Reason: ${data.adjustmentReason}`
        : "";
      history.push({
        actor: actorName,
        action: `Adjusted Good from ${log.goodQuantity} to ${data.goodQuantity}, Scrap from ${log.scrapQuantity} to ${data.scrapQuantity}${reasonText}`,
        date: new Date().toISOString(),
      });

      await prisma.$transaction(async (tx) => {
        await tx.productionLog.update({
          where: { id: logId },
          data: {
            goodQuantity: data.goodQuantity,
            scrapQuantity: data.scrapQuantity,
            adjustmentHistory: history,
          },
        });

        await logAuditTx(tx, {
          actor: actorName,
          action: "RECONCILE_EDIT_LOG",
          entityType: "PRODUCTION_LOG",
          entityId: logId,
          details: `Supervisor edited production log quantities`,
        });
      });

      return NextResponse.json({ success: true });
    } else if (type === "DOWNTIME") {
      const log = await prisma.downtimeLog.findUnique({
        where: { id: logId },
        include: { reason: true },
      });
      if (!log)
        return NextResponse.json({ error: "Log not found" }, { status: 404 });

      const history = log.adjustmentHistory
        ? (log.adjustmentHistory as any[])
        : [];
      let historyText = "";
      if (data.reasonId && data.reasonId !== log.reasonId) {
        const newReason = await prisma.downtimeReason.findUnique({
          where: { id: data.reasonId },
        });
        historyText += `Changed Reason from ${log.reason?.description || "none"} to ${newReason?.description || "none"}. `;
      }
      if (data.notes !== undefined && data.notes !== log.notes) {
        historyText += `Changed Notes. `;
      }
      if (
        data.durationMinutes !== undefined &&
        data.durationMinutes !== log.durationMinutes
      ) {
        historyText += `Changed Duration from ${log.durationMinutes} to ${data.durationMinutes}. `;
      }
      const reasonText = data.adjustmentReason
        ? `Reason: ${data.adjustmentReason}. `
        : "";

      history.push({
        actor: actorName,
        action: historyText + reasonText || "Edited downtime log",
        date: new Date().toISOString(),
      });

      await prisma.$transaction(async (tx) => {
        await tx.downtimeLog.update({
          where: { id: logId },
          data: {
            reasonId: data.reasonId !== undefined ? data.reasonId : log.reasonId,
            notes: data.notes !== undefined ? data.notes : log.notes,
            durationMinutes:
              data.durationMinutes !== undefined
                ? data.durationMinutes
                : log.durationMinutes,
            adjustmentHistory: history,
          },
        });

        await logAuditTx(tx, {
          actor: actorName,
          action: "RECONCILE_EDIT_LOG",
          entityType: "DOWNTIME_LOG",
          entityId: logId,
          details: `Supervisor edited downtime log`,
        });
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid log type" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to edit log:", error);
    return NextResponse.json({ error: "Failed to edit log" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id || (!user.isOwner && !can(user, "ops.edit") && !can(user, "records.edit") && !can(user, "system.edit"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const actorName = user.name || headerList.get("x-user-name") || "Supervisor";
    const { logIds, type } = body;

    if (!logIds || !Array.isArray(logIds)) {
      return NextResponse.json({ error: "Invalid logIds" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (type === "PRODUCTION") {
        await tx.productionLog.updateMany({
          where: { id: { in: logIds } },
          data: { status: "FINALIZED" },
        });
      } else if (type === "DOWNTIME") {
        await tx.downtimeLog.updateMany({
          where: { id: { in: logIds } },
          data: { status: "FINALIZED" },
        });
      } else if (type === "ALL") {
        await tx.productionLog.updateMany({
          where: { status: "DRAFT" },
          data: { status: "FINALIZED" },
        });
        await tx.downtimeLog.updateMany({
          where: { status: "DRAFT" },
          data: { status: "FINALIZED" },
        });
      }

      await logAuditTx(tx, {
        actor: actorName,
        action: "RECONCILE_FINALIZED",
        entityType: type === "DOWNTIME" ? "DowntimeLog" : "ProductionLog",
        details:
          type === "ALL"
            ? `Finalized all DRAFT production and downtime logs`
            : `Finalized ${logIds.length} ${type} log(s)`,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to close shift:", error);
    return NextResponse.json(
      { error: "Failed to close shift" },
      { status: 500 },
    );
  }
}
