import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { startOfWeek, addDays, format, isSameDay } from "date-fns";

export const maxDuration = 60;

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get("weekStart");
    const weekStart = startOfWeek(
      weekParam ? new Date(weekParam) : new Date(),
      { weekStartsOn: 1 },
    );
    const weekEnd = addDays(weekStart, 7);

    const [roster, shifts, operators, attendanceLogs, settings] =
      await Promise.all([
        prisma.shiftRoster.findUnique({
          where: { weekStart },
          include: {
            entries: {
              include: {
                user: {
                  select: { id: true, name: true, employeeNumber: true },
                },
                shift: {
                  select: {
                    id: true,
                    name: true,
                    startTime: true,
                    endTime: true,
                  },
                },
              },
            },
          },
        }),
        prisma.shift.findMany({
          where: { isActive: true },
          orderBy: { startTime: "asc" },
        }),
        prisma.user.findMany({
          where: {
            isActive: true,
            role: { name: { in: ["Operator", "OPERATOR"] } },
          },
          select: { id: true, name: true, employeeNumber: true },
          orderBy: { name: "asc" },
        }),
        prisma.attendanceLog.findMany({
          where: { clockIn: { gte: weekStart, lt: weekEnd } },
          include: { shift: { select: { id: true, name: true } } },
        }),
        getSettings(),
      ]);

    const entries = roster?.entries || [];
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayEntries = entries.filter(
        (e) => format(new Date(e.date), "yyyy-MM-dd") === dateStr,
      );
      const dayShifts = shifts.map((s) => {
        const onShift = dayEntries.filter((e) => e.shiftId === s.id);
        const attended = attendanceLogs.filter(
          (l) => l.shiftId === s.id && isSameDay(new Date(l.clockIn), d),
        ).length;
        const min = settings.minStaffingPerShift;
        return {
          shiftId: s.id,
          shiftName: s.name,
          rostered: onShift.length,
          attended,
          shortfall: Math.max(0, min - onShift.length),
          underMinimum: onShift.length < min,
          minStaffing: min,
          operators: onShift.map((e) => ({
            id: e.user.id,
            name: e.user.name,
            employeeNumber: e.user.employeeNumber,
          })),
        };
      });
      return {
        date: dateStr,
        label: format(d, "EEE dd MMM"),
        shifts: dayShifts,
      };
    });

    return NextResponse.json({
      weekStart: weekStart.toISOString(),
      roster: roster
        ? {
            id: roster.id,
            status: roster.status,
            publishedBy: roster.publishedBy,
            publishedAt: roster.publishedAt.toISOString(),
            notes: roster.notes,
          }
        : null,
      days,
      shifts,
      operators,
      minStaffingPerShift: settings.minStaffingPerShift,
      totalRostered: entries.length,
    });
  } catch (error) {
    console.error("GET /api/roster error:", error);
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
  if (!(await canAny(user, ["ops.edit", "people.edit"])))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );

    if (action === "publish") {
      const { weekStart, entries, notes } = data;
      const ws = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
      if (!Array.isArray(entries))
        return NextResponse.json(
          { error: "entries array required" },
          { status: 400 },
        );
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json(
          { error: "Manager level required" },
          { status: 403 },
        );

      const existing = await prisma.shiftRoster.findUnique({
        where: { weekStart: ws },
      });
      let roster;
      if (existing) {
        roster = await prisma.$transaction(async (tx) => {
          await tx.rosterEntry.deleteMany({ where: { rosterId: existing.id } });
          return tx.shiftRoster.update({
            where: { id: existing.id },
            data: {
              status: "PUBLISHED",
              publishedBy: user.name || "System",
              publishedAt: new Date(),
              notes: notes || existing.notes,
              entries: { create: entries },
            },
            include: { entries: true },
          });
        });
      } else {
        roster = await prisma.shiftRoster.create({
          data: {
            weekStart: ws,
            status: "PUBLISHED",
            publishedBy: user.name || "System",
            notes: notes || null,
            entries: { create: entries },
          },
          include: { entries: true },
        });
      }
      await logAudit({
        actor: user.name || "System",
        action: "ROSTER_PUBLISHED",
        entityType: "SHIFT_ROSTER",
        entityId: roster.id,
        details: `Week of ${format(ws, "dd MMM yyyy")} — ${roster.entries.length} entry(ies)`,
      });
      return NextResponse.json({ roster }, { status: 201 });
    }

    if (action === "minimum-staffing-check") {
      // returns how many entries a leave would remove per day/shift vs minimum
      const { userId, fromDate, toDate } = data;
      const ws = startOfWeek(new Date(fromDate), { weekStartsOn: 1 });
      const roster = await prisma.shiftRoster.findUnique({
        where: { weekStart: ws },
        include: { entries: { include: { shift: true } } },
      });
      const settings = await getSettings();
      const min = settings.minStaffingPerShift;
      const hits: any[] = [];
      if (roster) {
        let day = startOfWeek(new Date(fromDate), { weekStartsOn: 1 });
        const end = addDays(
          startOfWeek(new Date(toDate), { weekStartsOn: 1 }),
          7,
        );
        while (day < end) {
          const dayEntries = roster.entries.filter((e) =>
            isSameDay(new Date(e.date), day),
          );
          const groups = new Map<string, any[]>();
          for (const e of dayEntries) {
            if (e.userId === userId) continue; // after the leave
            if (!groups.has(e.shiftId)) groups.set(e.shiftId, []);
            groups.get(e.shiftId)!.push(e);
          }
          for (const s of roster.entries) {
            if (isSameDay(new Date(s.date), day) && s.userId === userId) {
              const after = groups.get(s.shiftId)?.length || 0;
              if (after < min) {
                hits.push({
                  date: format(day, "yyyy-MM-dd"),
                  shiftName: s.shift.name,
                  afterStaffing: after,
                  minStaffing: min,
                });
              }
            }
          }
          day = addDays(day, 1);
        }
      }
      return NextResponse.json({ underMinimum: hits });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/roster error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
