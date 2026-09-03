import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [openJobs, allPMRules, allTools] = await Promise.all([
      (prisma as any).maintenanceJob.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      (prisma as any).pMRule.findMany({
        where: { isActive: true },
        select: { id: true, lastDoneAt: true, intervalDays: true },
      }),
      (prisma as any).maintenanceTool.findMany({
        select: { id: true, usedUnits: true, ratedLifeUnits: true },
      }),
    ]);

    const now = new Date();

    const overduePM = allPMRules.filter((r: any) => {
      if (!r.lastDoneAt && !r.intervalDays) return false;
      if (!r.lastDoneAt) return true; // never done
      if (!r.intervalDays) return false;
      const nextDue = new Date(r.lastDoneAt);
      nextDue.setDate(nextDue.getDate() + r.intervalDays);
      return nextDue < now;
    }).length;

    let warnCount = 0;
    let replaceCount = 0;
    for (const t of allTools) {
      if (t.ratedLifeUnits <= 0) continue;
      const pct = (t.usedUnits / t.ratedLifeUnits) * 100;
      if (pct >= 100) replaceCount++;
      else if (pct >= 90) warnCount++;
    }

    return NextResponse.json({
      openJobs,
      overduePM,
      warnTools: warnCount,
      replaceTools: replaceCount,
      hasReplace: replaceCount > 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
