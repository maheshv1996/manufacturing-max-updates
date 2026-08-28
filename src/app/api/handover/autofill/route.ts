import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const machineId = searchParams.get("machineId");

    if (!dateStr) {
      return NextResponse.json(
        { error: "Missing date parameter" },
        { status: 400 },
      );
    }

    const from = new Date(dateStr);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const machineWhere =
      machineId && machineId !== "PLANT" ? { machineId } : {};

    const [productionLogs, downtimeLogs, activeWorkOrders] = await Promise.all([
      prisma.productionLog.findMany({
        where: {
          startTime: { gte: from, lt: to },
          ...machineWhere,
        },
      }),
      prisma.downtimeLog.findMany({
        where: {
          startTime: { gte: from, lt: to },
          ...machineWhere,
        },
        include: { reason: true },
      }),
      prisma.workOrder.findMany({
        where: {
          status: { in: ["IN_PROGRESS", "PLANNED"] },
        },
      }),
    ]);

    let totalGood = 0;
    let totalScrap = 0;
    productionLogs.forEach((log) => {
      totalGood += log.goodQuantity || 0;
      totalScrap += log.scrapQuantity || 0;
    });

    const totalPlanned =
      activeWorkOrders.reduce(
        (sum, wo) => sum + (wo.plannedQuantity || 1000),
        0,
      ) || 1000;
    const achievementPct = Number(
      ((totalGood / totalPlanned) * 100).toFixed(1),
    );
    const targetMissed = achievementPct < 95;

    const prodSummary = `Total Good Units: ${totalGood.toLocaleString()}. Total Scrap: ${totalScrap.toLocaleString()}. Plan vs Actual: ${totalGood}/${totalPlanned} (${achievementPct}%).`;

    let totalDowntimeMin = 0;
    const dtMap = new Map<string, number>();

    downtimeLogs.forEach((log) => {
      let dur = 0;
      if (log.endTime) {
        dur = Math.round(
          (log.endTime.getTime() - log.startTime.getTime()) / (1000 * 60),
        );
      } else {
        dur = Math.round(
          (to.getTime() - log.startTime.getTime()) / (1000 * 60),
        );
      }
      if (dur < 0) dur = 0;
      totalDowntimeMin += dur;

      const reasonDesc = log.reason?.description || "Unclassified Stoppage";
      dtMap.set(reasonDesc, (dtMap.get(reasonDesc) || 0) + dur);
    });

    const dtParts: string[] = [];
    dtMap.forEach((min, desc) => dtParts.push(`${desc}: ${min} mins`));
    const dtSummary = `Total Downtime: ${totalDowntimeMin} mins. Breakdown: ${dtParts.length > 0 ? dtParts.join("; ") : "None"}.`;

    return NextResponse.json({
      productionNotes: prodSummary,
      downtimeNotes: dtSummary,
      totalGood,
      totalPlanned,
      achievementPct,
      targetMissed,
    });
  } catch (error: any) {
    console.error("Autofill error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
