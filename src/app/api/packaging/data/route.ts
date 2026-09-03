import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [workOrders, recentScans, shifts, operators] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          status: { in: ["IN_PROGRESS", "PLANNED", "COMPLETED"] },
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 40,
      }),
      prisma.packagingScanLog.findMany({
        where: {
          timestamp: { gte: todayStart },
        },
        include: {
          workOrder: {
            select: {
              id: true,
              woNumber: true,
              plannedQuantity: true,
              packedQuantity: true,
              product: { select: { name: true, sku: true } },
            },
          },
          operator: { select: { id: true, name: true, employeeNumber: true } },
          shift: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 50,
      }),
      prisma.shift.findMany({ where: { isActive: true } }),
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          employeeNumber: true,
          role: { select: { name: true } },
        },
      }),
    ]);

    // Current shift detection
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentShift =
      shifts.find((s) => {
        if (s.startTime <= s.endTime) {
          return nowStr >= s.startTime && nowStr <= s.endTime;
        } else {
          return nowStr >= s.startTime || nowStr <= s.endTime;
        }
      }) ||
      shifts[0] ||
      null;

    // Shift stats calculation
    const totalPackedToday = recentScans.reduce(
      (acc, s) =>
        s.result === "SUCCESS" || s.result === "OVERPACK"
          ? acc + s.quantity
          : acc,
      0,
    );
    const activeWos = workOrders.filter(
      (w) => w.status === "IN_PROGRESS" || w.status === "PLANNED",
    );
    const totalPlannedTarget =
      activeWos.reduce((acc, w) => acc + w.plannedQuantity, 0) || 100;
    const backlog = Math.max(
      0,
      activeWos.reduce(
        (acc, w) => acc + (w.plannedQuantity - w.packedQuantity),
        0,
      ),
    );
    const realizationPct =
      totalPlannedTarget > 0
        ? Math.min(
            100,
            Math.round((totalPackedToday / totalPlannedTarget) * 100),
          )
        : 0;

    return NextResponse.json({
      workOrders,
      recentScans,
      shifts,
      operators,
      currentShift,
      stats: {
        totalPackedToday,
        shiftTarget: totalPlannedTarget,
        realizationPct,
        backlog,
      },
    });
  } catch (error: any) {
    console.error("Failed to load packaging data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
