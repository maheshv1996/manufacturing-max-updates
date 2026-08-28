import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user || (!user.isOwner && !can(user, "ops.view"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const now = new Date();

    const [wos, logs] = await Promise.all([
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: { product: { include: { routingSteps: true } } },
      }),
      prisma.productionLog.findMany({
        where: { startTime: { gte: todayStart, lt: todayEnd } },
        include: {
          machine: { select: { name: true } },
          workOrder: { select: { woNumber: true } },
        },
      }),
    ]);

    // target pieces/hour per machine from the active WO's first op cycle time
    const targetPerHour = new Map<string, number>();
    for (const wo of wos) {
      for (const step of wo.product?.routingSteps || []) {
        if (!step.machineId) continue;
        const cycleSec = step.cycleTimeMin ? step.cycleTimeMin * 60 : 60;
        targetPerHour.set(
          step.machineId,
          Math.max(1, Math.round(3600 / cycleSec)),
        );
        break; // first op per machine
      }
    }

    // actual pieces per machine per hour (good + scrap count as throughput)
    const machines = await prisma.machine.findMany();
    const rows = machines.map((m) => {
      const target = targetPerHour.get(m.id) || 0;
      const hours: { hour: number; actual: number; short: boolean }[] = [];
      for (let h = 0; h < 24; h++) {
        if (now.getHours() <= h) break;
        const actual = logs
          .filter(
            (l) =>
              l.machineId === m.id && new Date(l.startTime).getHours() === h,
          )
          .reduce((s, l) => s + l.goodQuantity + l.scrapQuantity, 0);
        hours.push({ hour: h, actual, short: target > 0 && actual < target });
      }
      const shortHours = hours.filter((h) => h.short).length;
      // M5 — 2 short hours = flag
      const flagged = shortHours >= 2;
      return {
        machineId: m.id,
        machineName: m.name,
        target,
        hours,
        shortHours,
        flagged,
        wos: wos
          .filter((w) =>
            w.product?.routingSteps?.some((s) => s.machineId === m.id),
          )
          .map((w) => w.woNumber),
      };
    });

    return NextResponse.json({
      date: todayStart.toISOString().slice(0, 10),
      rows,
      flagged: rows.filter((r) => r.flagged).map((r) => r.machineName),
      stats: {
        machines: rows.length,
        short: rows.filter((r) => r.shortHours > 0).length,
        flagged: rows.filter((r) => r.flagged).length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/andon/hourly error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
