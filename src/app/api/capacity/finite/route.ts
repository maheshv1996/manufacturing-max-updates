import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const DAY = 86400000;
const HORIZON_DAYS = 14;

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "ops.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [settings, wos, machines] = await Promise.all([
      prisma.setting.findMany({
        where: { key: { in: ["dailyAvailableHours", "minStaffingPerShift"] } },
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: {
          product: {
            include: {
              routingSteps: {
                include: { machine: true },
                orderBy: { seq: "asc" },
              },
            },
          },
        },
        orderBy: { priority: "asc" },
      }),
      prisma.machine.findMany({ orderBy: { name: "asc" } }),
    ]);
    const availablePerDay = Number(
      settings.find((s) => s.key === "dailyAvailableHours")?.value || 16,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from(
      { length: HORIZON_DAYS },
      (_, i) => new Date(today.getTime() + i * DAY),
    );

    // machineId -> per-day load hours + per-day WO list
    const load = new Map<string, { hours: number[]; wos: string[][] }>();
    machines.forEach((m) =>
      load.set(m.id, {
        hours: Array(HORIZON_DAYS).fill(0),
        wos: Array.from({ length: HORIZON_DAYS }, () => []),
      }),
    );

    for (const wo of wos) {
      const start = new Date(wo.plannedStartDate);
      const end = new Date(wo.plannedEndDate);
      if (end < today) continue;
      const winStart = Math.max(
        0,
        Math.floor((start.getTime() - today.getTime()) / DAY),
      );
      const winEnd = Math.min(
        HORIZON_DAYS - 1,
        Math.floor((end.getTime() - today.getTime()) / DAY),
      );
      if (winEnd < 0) continue;
      const spanDays = Math.max(1, winEnd - winStart + 1);

      for (const step of wo.product?.routingSteps || []) {
        if (!step.machineId) continue;
        const hours =
          (step.setupTimeMin ?? 15) / 60 +
          ((step.cycleTimeMin ?? 2.5) * (wo.plannedQuantity || 1)) / 60;
        const perDay = hours / spanDays;
        for (
          let d = Math.max(0, winStart);
          d <= winEnd && d < HORIZON_DAYS;
          d++
        ) {
          const slot = load.get(step.machineId);
          if (!slot) continue;
          slot.hours[d] += perDay;
          if (!slot.wos[d].includes(wo.woNumber)) slot.wos[d].push(wo.woNumber);
        }
      }
    }

    const grid = machines.map((m) => {
      const slot = load.get(m.id)!;
      return {
        machineId: m.id,
        machineName: m.name,
        code: m.code,
        hours: slot.hours.map((h) => Math.round(h * 10) / 10),
        loadPct: slot.hours.map((h) => Math.round((h / availablePerDay) * 100)),
        wos: slot.wos,
        overloadedDays: slot.hours.filter((h) => h > availablePerDay).length,
      };
    });

    return NextResponse.json({
      days: days.map((d) => d.toISOString().slice(0, 10)),
      availablePerDay,
      grid,
      totals: {
        overloadedCells: grid.reduce((s, g) => s + g.overloadedDays, 0),
      },
    });
  } catch (error: any) {
    console.error("GET /api/capacity/finite error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
