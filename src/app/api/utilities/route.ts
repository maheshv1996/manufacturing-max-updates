import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

const TYPES = ["POWER", "COMPRESSED_AIR", "HVAC", "WATER", "GAS"];
const DAY = 86400000;

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, [
        "maintenance.view",
        "maintenance.edit",
        "system.view",
        "system.edit",
      ]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const month =
      url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const [ys, ms] = month.split("-").map(Number);
    const start = new Date(ys, ms - 1, 1);
    const end = new Date(ys, ms, 0, 23, 59, 59, 999);
    const prevStart = new Date(ys, ms - 2, 1);
    const prevEnd = new Date(ys, ms - 1, 0, 23, 59, 59, 999);

    const [monthReadings, prevReadings, trendReadings] = await Promise.all([
      prisma.utilityReading.findMany({
        where: { readAt: { gte: start, lte: end } },
        orderBy: { readAt: "asc" },
      }),
      prisma.utilityReading.findMany({
        where: { readAt: { gte: prevStart, lte: prevEnd } },
      }),
      prisma.utilityReading.findMany({
        where: { readAt: { gte: new Date(Date.now() - 35 * DAY) } },
        orderBy: { readAt: "asc" },
      }),
    ]);

    const sum = (rs: any[]) => ({
      reading: rs.reduce((s, r) => s + r.reading, 0),
      cost: rs.reduce((s, r) => s + r.cost, 0),
    });
    const kpis = TYPES.map((t) => {
      const m = monthReadings.filter((r) => r.utilityType === t);
      const p = prevReadings.filter((r) => r.utilityType === t);
      const cur = sum(m);
      const prev = sum(p);
      const deltaPct =
        prev.reading > 0
          ? Math.round(((cur.reading - prev.reading) / prev.reading) * 1000) /
            10
          : null;
      const daysLogged = new Set(
        m.map((r) => r.readAt.toISOString().slice(0, 10)),
      ).size;
      return {
        type: t,
        reading: Math.round(cur.reading * 100) / 100,
        cost: cur.cost,
        daysLogged,
        prevReading: Math.round(prev.reading * 100) / 100,
        deltaPct,
      };
    });
    const trend = TYPES.map((t) => ({
      type: t,
      points: trendReadings
        .filter((r) => r.utilityType === t)
        .map((r) => ({
          day: r.readAt.toISOString().slice(0, 10),
          reading: r.reading,
          cost: r.cost,
        })),
    })).filter((t) => t.points.length > 0);

    return NextResponse.json({
      kpis,
      trend,
      readings: monthReadings.reverse(),
      month,
      types: TYPES,
    });
  } catch (error) {
    console.error("GET /api/utilities error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = user.name || "Admin";
  try {
    const body = await req.json();
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["maintenance.edit", "system.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager, maintenance.edit or system.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-reading") {
      const { utilityType, meterName, reading, unit, cost, readAt, notes } =
        data;
      if (!utilityType || !TYPES.includes(utilityType))
        return NextResponse.json(
          {
            error: "utilityType required (POWER|COMPRESSED_AIR|HVAC|WATER|GAS)",
          },
          { status: 400 },
        );
      if (reading === undefined || reading === null || reading === "")
        return NextResponse.json(
          { error: "reading required" },
          { status: 400 },
        );
      result = await prisma.utilityReading.create({
        data: {
          utilityType,
          meterName: meterName || null,
          reading: Number(reading),
          unit:
            unit ||
            (utilityType === "POWER"
              ? "kWh"
              : utilityType === "COMPRESSED_AIR"
                ? "h"
                : "unit"),
          cost: cost !== undefined && cost !== null ? Number(cost) : 0,
          readAt: readAt ? new Date(readAt) : new Date(),
          notes: notes || null,
        },
      });
      await logAudit({
        actor,
        action: "UTILITY_READING_CREATED",
        entityType: "UTILITY_READING",
        entityId: result.id,
        details: `${utilityType} · ${result.reading} ${result.unit} @ ${result.readAt.toISOString().slice(0, 10)}`,
      });
    } else if (action === "update-reading") {
      const r = await prisma.utilityReading.findUnique({
        where: { id: data.id },
      });
      if (!r)
        return NextResponse.json(
          { error: "Reading not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.utilityType !== undefined) patch.utilityType = data.utilityType;
      if (data.meterName !== undefined)
        patch.meterName = data.meterName || null;
      if (data.reading !== undefined && data.reading !== null)
        patch.reading = Number(data.reading);
      if (data.unit !== undefined) patch.unit = data.unit;
      if (data.cost !== undefined && data.cost !== null)
        patch.cost = Number(data.cost);
      if (data.readAt !== undefined && data.readAt !== null)
        patch.readAt = new Date(data.readAt);
      if (data.notes !== undefined) patch.notes = data.notes || null;
      result = await prisma.utilityReading.update({
        where: { id: r.id },
        data: patch,
      });
      await logAudit({
        actor,
        action: "UTILITY_READING_UPDATED",
        entityType: "UTILITY_READING",
        entityId: r.id,
        details: `${r.utilityType} · ${result.reading}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/utilities error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
