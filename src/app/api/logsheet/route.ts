import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getUserFromHeaders } from "@/lib/permissions";
import { startOfDay, addDays } from "date-fns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId");
    const shiftId = searchParams.get("shiftId");
    const date = searchParams.get("date");
    const status = searchParams.get("status");

    // If a specific machine is requested with no status filter, return that specific sheet
    if (machineId && !status) {
      const sheet = await prisma.logsheet.findFirst({
        where: {
          machineId,
          ...(shiftId ? { shiftId } : {}),
          ...(date ? { logDate: startOfDay(new Date(date)) } : {}),
        },
        include: {
          machine: { select: { id: true, code: true, name: true, plantId: true } },
          shift: true,
          operator: { select: { id: true, name: true, email: true } },
        },
        orderBy: { logDate: "desc" },
      });
      return NextResponse.json(sheet || null);
    }

    // Otherwise return list of logsheets for verification inbox
    const sheets = await prisma.logsheet.findMany({
      where: {
        ...(status && status !== "ALL" ? { status: status as any } : {}),
        ...(date ? { logDate: startOfDay(new Date(date)) } : {}),
        ...(machineId ? { machineId } : {}),
        ...(shiftId ? { shiftId } : {}),
      },
      include: {
        machine: { select: { id: true, code: true, name: true, plantId: true } },
        shift: true,
        operator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { logDate: "desc" },
    });

    return NextResponse.json(sheets);
  } catch (error) {
    console.error("Logsheet GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logsheet" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const actorName = user?.name || headersList.get("x-user-name") || "Operator";

  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { machineId, shiftId, logDate, entries, remarks } = body;

    if (!machineId || !shiftId || !logDate) {
      return NextResponse.json(
        { error: "machineId, shiftId and logDate are required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: "entries must be an array" },
        { status: 400 },
      );
    }

    const dayStart = startOfDay(new Date(logDate));
    const operatorId = body.operatorId || headersList.get("x-user-id") || null;

    const sheet = await prisma.logsheet.upsert({
      where: {
        machineId_shiftId_logDate: { machineId, shiftId, logDate: dayStart },
      },
      update: { entries, remarks: remarks || null },
      create: {
        machineId,
        shiftId,
        operatorId: operatorId || null,
        logDate: dayStart,
        entries,
        remarks: remarks || null,
      },
    });

    await logAudit({
      actor: actorName,
      action: "LOGSHEET_SAVED",
      entityType: "Logsheet",
      entityId: sheet.id,
      details: `${sheet.machineId} · ${dayStart.toISOString().slice(0, 10)} · ${entries.length} entries`,
    });

    return NextResponse.json(sheet, { status: 201 });
  } catch (error) {
    console.error("Logsheet POST error:", error);
    return NextResponse.json(
      { error: "Failed to save logsheet" },
      { status: 500 },
    );
  }
}

// Recompute the system-side totals for a machine+shift+day — used by the
// supervisor verify endpoint to cross-check the operator's manual sheet.
export async function getSystemTotals(
  machineId: string,
  shiftId: string,
  logDate: Date,
) {
  const windowStart = startOfDay(logDate);
  const windowEnd = addDays(windowStart, 1);

  const agg = await prisma.productionLog.aggregate({
    where: {
      machineId,
      shiftId,
      startTime: { gte: windowStart, lt: windowEnd },
    },
    _sum: { goodQuantity: true, scrapQuantity: true, reworkQuantity: true },
  });

  return {
    good: agg._sum.goodQuantity || 0,
    scrap: agg._sum.scrapQuantity || 0,
    rework: agg._sum.reworkQuantity || 0,
  };
}
