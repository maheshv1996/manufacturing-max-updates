import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { headers } from "next/headers";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [
      machines,
      users,
      products,
      lines,
      shifts,
      downtimeReasons,
      defectCodes,
      workOrders,
      operations,
      routingSteps,
      assignments,
      productionLogs,
      energyReadings,
      settings,
      plants,
      attendanceDevices,
    ] = await Promise.all([
      prisma.machine.findMany({
        include: {
          line: true,
          assignments: {
            where: { status: "ACTIVE" },
            include: { operator: true, shift: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        include: {
          assignments: {
            where: { status: "ACTIVE" },
            include: { machine: true, shift: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({ orderBy: { name: "asc" } }),
      prisma.productionLine.findMany({
        include: { plant: true },
        orderBy: { name: "asc" },
      }),
      prisma.shift.findMany({ orderBy: { name: "asc" } }),
      prisma.downtimeReason.findMany({ orderBy: { code: "asc" } }),
      prisma.defectCode.findMany({ orderBy: { code: "asc" } }),
      prisma.workOrder.findMany({
        include: {
          product: true,
          productionLogs: { select: { machineId: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.operation.findMany({ orderBy: { code: "asc" } }),
      prisma.routingStep.findMany({
        include: { operation: true, product: true },
        orderBy: [{ productId: "asc" }, { seq: "asc" }],
      }),
      prisma.assignment.findMany({
        include: { machine: true, operator: true, shift: true },
        orderBy: { validFrom: "desc" },
      }),
      prisma.productionLog.findMany({
        include: { machine: true },
      }),
      prisma.energyReading.findMany({
        orderBy: { date: "desc" },
        take: 30,
      }),
      getSettings(),
      prisma.plant.findMany({ orderBy: { name: "asc" } }),
      prisma.attendanceDevice.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Calculate operator stats per machine
    const operatorStatsMap: Record<string, any[]> = {};

    for (const log of productionLogs) {
      if (!log.operatorId || !log.machine) continue;
      if (!operatorStatsMap[log.operatorId]) {
        operatorStatsMap[log.operatorId] = [];
      }

      let mStat = operatorStatsMap[log.operatorId].find(
        (s) => s.machineId === log.machineId,
      );
      if (!mStat) {
        mStat = {
          machineId: log.machineId,
          machineName: log.machine.name,
          machineCode: log.machine.code,
          idealCycleTimeSeconds: log.machine.idealCycleTimeSeconds || 60,
          totalLoggedSeconds: 0,
          goodUnits: 0,
          scrapUnits: 0,
        };
        operatorStatsMap[log.operatorId].push(mStat);
      }

      const durationSec =
        log.startTime && log.endTime
          ? Math.max(
              0,
              (new Date(log.endTime).getTime() -
                new Date(log.startTime).getTime()) /
                1000,
            )
          : 3600; // default 1h if missing

      mStat.totalLoggedSeconds += durationSec;
      mStat.goodUnits += log.goodQuantity || 0;
      mStat.scrapUnits += log.scrapQuantity || 0;
    }

    // Process stats into final format with efficiency & ratings
    const operatorStats: Record<string, any> = {};
    for (const [opId, mStats] of Object.entries(operatorStatsMap)) {
      const processed = mStats.map((s) => {
        const hoursLogged = Math.max(
          0.1,
          Number((s.totalLoggedSeconds / 3600).toFixed(1)),
        );
        const totalTotal = s.goodUnits + s.scrapUnits;
        const scrapPct =
          totalTotal > 0
            ? Number(((s.scrapUnits / totalTotal) * 100).toFixed(1))
            : 0;
        const effPct = Math.min(
          120,
          Number(
            (
              ((s.goodUnits * s.idealCycleTimeSeconds) / (hoursLogged * 3600)) *
              100
            ).toFixed(1),
          ),
        );

        let rating = "Wrong role?";
        let ratingColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
        if (effPct >= 95) {
          rating = "Excellent";
          ratingColor =
            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        } else if (effPct >= 80) {
          rating = "Good";
          ratingColor = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
        } else if (effPct >= 65) {
          rating = "Needs coaching";
          ratingColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        }

        return {
          machineId: s.machineId,
          machineName: s.machineName,
          machineCode: s.machineCode,
          hoursLogged,
          goodUnits: s.goodUnits,
          scrapPct,
          efficiencyPct: effPct,
          rating,
          ratingColor,
        };
      });

      // Sort by efficiency descending
      processed.sort((a, b) => b.efficiencyPct - a.efficiencyPct);

      const bestFit = processed.length > 0 ? processed[0] : null;

      operatorStats[opId] = {
        machineStats: processed,
        bestFit,
      };
    }

    const currentUserId = headersList.get("x-user-id");

    const sanitizedUsers = users.map((u: any) => {
      const { passwordHash, lastSetPassword, ...rest } = u;
      return {
        ...rest,
        passwordChangedAt: u.passwordChangedAt,
      };
    });

    return NextResponse.json({
      currentUserId,
      machines,
      users: sanitizedUsers,
      products,
      lines,
      shifts,
      downtimeReasons,
      defectCodes,
      workOrders,
      operations,
      routingSteps,
      assignments,
      operatorStats,
      energyReadings,
      settings,
      plants,
      attendanceDevices,
    });
  } catch (error) {
    console.error("Failed to fetch admin data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
