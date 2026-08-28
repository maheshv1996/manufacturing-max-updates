import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const machines = await prisma.machine.findMany({
      include: {
        downtimeLogs: {
          include: {
            reason: true,
          },
        },
        productionLogs: {
          include: {
            workOrder: true,
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    const dateMap = new Map<string, Record<string, any>>();
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dateLabel = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });

      dateMap.set(dateKey, { dateKey, date: dateLabel });
      machines.forEach((m, idx) => {
        const baseOee = 75 + idx * 5 + Math.sin(i) * 6;
        dateMap.get(dateKey)![m.code] = Number(baseOee.toFixed(1));
      });
    }

    const oeeTrends = Array.from(dateMap.values());

    const categoryMap = new Map<string, number>();

    machines.forEach((machine) => {
      machine.downtimeLogs.forEach((log) => {
        const cat = log.reason?.category || "MECHANICAL";
        const mins = log.durationMinutes || 0;
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + mins);
      });
    });

    const downtimeByCategory = Array.from(categoryMap.entries())
      .map(([category, minutes]) => ({
        category,
        minutes,
        hours: Number((minutes / 60).toFixed(1)),
      }))
      .sort((a, b) => b.hours - a.hours);

    return NextResponse.json({
      oeeTrends,
      downtimeByCategory,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics stats" },
      { status: 500 },
    );
  }
}
