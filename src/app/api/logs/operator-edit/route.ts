import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { logId, type, data } = body;
    const headerList = await headers();
    const actorName = headerList.get("x-user-name") || "Operator";

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
      if (log.status !== "DRAFT")
        return NextResponse.json(
          { error: "Log is finalized" },
          { status: 403 },
        );

      const ageMs = Date.now() - new Date(log.createdAt).getTime();
      if (ageMs > 15 * 60 * 1000) {
        return NextResponse.json(
          { error: "15-minute edit window has expired" },
          { status: 403 },
        );
      }

      const history = log.adjustmentHistory
        ? (log.adjustmentHistory as any[])
        : [];
      history.push({
        actor: actorName,
        action: `Adjusted Good from ${log.goodQuantity} to ${data.goodQuantity}, Scrap from ${log.scrapQuantity} to ${data.scrapQuantity}`,
        date: new Date().toISOString(),
      });

      await prisma.productionLog.update({
        where: { id: logId },
        data: {
          goodQuantity: data.goodQuantity,
          scrapQuantity: data.scrapQuantity,
          adjustmentHistory: history,
        },
      });

      await logAudit({
        actor: actorName,
        action: "OPERATOR_EDIT_LOG",
        entityType: "PRODUCTION_LOG",
        entityId: logId,
        details: `Edited production log quantities`,
      });

      return NextResponse.json({ success: true });
    } else if (type === "DOWNTIME") {
      const log = await prisma.downtimeLog.findUnique({
        where: { id: logId },
        include: { reason: true },
      });
      if (!log)
        return NextResponse.json({ error: "Log not found" }, { status: 404 });
      if (log.status !== "DRAFT")
        return NextResponse.json(
          { error: "Log is finalized" },
          { status: 403 },
        );

      const ageMs = Date.now() - new Date(log.createdAt).getTime();
      if (ageMs > 15 * 60 * 1000) {
        return NextResponse.json(
          { error: "15-minute edit window has expired" },
          { status: 403 },
        );
      }

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
      if (data.notes && data.notes !== log.notes) {
        historyText += `Changed Notes. `;
      }

      history.push({
        actor: actorName,
        action: historyText || "Edited downtime log",
        date: new Date().toISOString(),
      });

      await prisma.downtimeLog.update({
        where: { id: logId },
        data: {
          reasonId: data.reasonId,
          notes: data.notes,
          adjustmentHistory: history,
        },
      });

      await logAudit({
        actor: actorName,
        action: "OPERATOR_EDIT_LOG",
        entityType: "DOWNTIME_LOG",
        entityId: logId,
        details: `Edited downtime log`,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid log type" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to edit log:", error);
    return NextResponse.json({ error: "Failed to edit log" }, { status: 500 });
  }
}
