import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["quality.view", "ops.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [items, audits, machines] = await Promise.all([
      prisma.fiveSItem.findMany({
        orderBy: [{ category: "asc" }, { seq: "asc" }],
      }),
      prisma.fiveSAudit.findMany({
        include: {
          scores: {
            include: { item: true },
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.machine.findMany({ select: { stationName: true } }),
    ]);

    // Unique existing areas list
    const areaSet = new Set<string>();
    audits.forEach((a) => areaSet.add(a.area));
    machines.forEach((m) => {
      if (m.stationName) areaSet.add(m.stationName);
    });
    areaSet.add("CNC Bay");
    areaSet.add("Assembly");
    areaSet.add("Stores");

    const existingAreas = Array.from(areaSet).sort();

    // Area Ranking Averages
    const areaMap: Record<
      string,
      { totalPctSum: number; count: number; scoresList: number[] }
    > = {};
    audits.forEach((a) => {
      if (!areaMap[a.area]) {
        areaMap[a.area] = { totalPctSum: 0, count: 0, scoresList: [] };
      }
      areaMap[a.area].totalPctSum += a.totalPct;
      areaMap[a.area].count += 1;
      areaMap[a.area].scoresList.push(a.totalPct);
    });

    const areaRankings = Object.entries(areaMap)
      .map(([area, data]) => ({
        area,
        avgPct: Number((data.totalPctSum / data.count).toFixed(1)),
        count: data.count,
        latestPct: data.scoresList[0] || 0,
      }))
      .sort((a, b) => b.avgPct - a.avgPct)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    // Weekly Summary (Past 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyAudits = audits.filter((a) => new Date(a.date) >= sevenDaysAgo);
    const weeklyAreaMap: Record<string, { sum: number; count: number }> = {};

    weeklyAudits.forEach((a) => {
      if (!weeklyAreaMap[a.area]) {
        weeklyAreaMap[a.area] = { sum: 0, count: 0 };
      }
      weeklyAreaMap[a.area].sum += a.totalPct;
      weeklyAreaMap[a.area].count += 1;
    });

    const weeklyStats = Object.entries(weeklyAreaMap)
      .map(([area, data]) => ({
        area,
        pct: Number((data.sum / data.count).toFixed(1)),
      }))
      .sort((a, b) => b.pct - a.pct);

    const weeklySummary = {
      best: weeklyStats.length > 0 ? weeklyStats[0] : null,
      worst:
        weeklyStats.length > 0 ? weeklyStats[weeklyStats.length - 1] : null,
    };

    return NextResponse.json({
      items,
      audits,
      areaRankings,
      weeklySummary,
      existingAreas,
    });
  } catch (error: any) {
    console.error("Fetch 5S data error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
