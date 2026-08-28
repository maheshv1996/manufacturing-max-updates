import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// M20 — Time Office: late / early / absent flags per shift-day, and an OT register
// that counts APPROVED overtime ONLY (PENDING/REJECTED never enter the register).

const PRESENT = "PRESENT";
const LATE = "LATE";
const EARLY = "EARLY";
const ABSENT = "ABSENT";
const LEAVE = "LEAVE";

function toMin(s: string) {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const month =
      searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const mIdx = parseInt(monthStr, 10) - 1;
    const startDate = new Date(year, mIdx, 1);
    const endDate = new Date(year, mIdx + 1, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

    const gate =
      canAny(user, ["people.view", "people.edit", "system.edit"]) ||
      user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [
      shifts,
      logs,
      overtime,
      rosterEntries,
      activeAssignments,
      leaves,
      graceSetting,
    ] = await Promise.all([
      prisma.shift.findMany(),
      prisma.attendanceLog.findMany({
        where: { clockIn: { gte: startDate, lte: endDate } },
        include: {
          user: { select: { id: true, name: true, employeeNumber: true } },
          shift: true,
        },
        orderBy: { clockIn: "asc" },
      }),
      prisma.overtimeRequest.findMany({
        where: { status: "APPROVED", date: { gte: startDate, lte: endDate } },
        include: {
          user: { select: { id: true, name: true, employeeNumber: true } },
        },
        orderBy: { date: "asc" },
      }),
      prisma.rosterEntry.findMany({
        where: { date: { gte: startDate, lte: endDate } },
      }),
      prisma.assignment.findMany({ where: { status: "ACTIVE" } }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          fromDate: { lte: endDate },
          toDate: { gte: startDate },
        },
        select: { userId: true, fromDate: true, toDate: true },
      }),
      prisma.setting.findUnique({ where: { key: "attendance_grace_minutes" } }),
    ]);
    const graceMinutes = graceSetting ? parseInt(graceSetting.value, 10) : 10;
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const leaveByUser = new Map<string, { from: Date; to: Date }[]>();
    leaves.forEach((l) => {
      const arr = leaveByUser.get(l.userId) || [];
      arr.push({ from: l.fromDate, to: l.toDate });
      leaveByUser.set(l.userId, arr);
    });

    // People who appear anywhere in the month (attendance / roster / approved OT).
    const userIds = new Set<string>();
    logs.forEach((l) => userIds.add(l.userId));
    rosterEntries.forEach((r) => userIds.add(r.userId));
    overtime.forEach((o) => userIds.add(o.userId));
    activeAssignments.forEach((a) => userIds.add(a.operatorId));
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) }, isActive: true },
      select: { id: true, name: true, employeeNumber: true },
      orderBy: { name: "asc" },
    });

    const rows = users.map((u) => {
      const days: any[] = [];
      let late = 0,
        early = 0,
        absent = 0,
        present = 0;
      const span = logs
        .filter((l) => l.userId === u.id)
        .reduce(
          (acc, l) => {
            const t = l.clockIn.getTime();
            if (acc.min === null || t < acc.min) acc.min = t;
            if (acc.max === null || t > acc.max) acc.max = t;
            return acc;
          },
          { min: null as number | null, max: null as number | null },
        );
      const rosterDates = rosterEntries
        .filter((r) => r.userId === u.id)
        .map((r) => r.date.getTime());
      if (rosterDates.length > 0) {
        const rMin = Math.min(...rosterDates);
        const rMax = Math.max(...rosterDates);
        if (span.min === null || rMin < span.min) span.min = rMin;
        if (span.max === null || rMax > span.max) span.max = rMax;
      }
      // Floor the span to whole days so the first/last clock-in day itself is counted.
      if (span.min !== null) span.min = new Date(span.min).setHours(0, 0, 0, 0);
      if (span.max !== null)
        span.max = new Date(span.max).setHours(23, 59, 59, 999);
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(year, mIdx, d);
        const dow = dayDate.getDay();
        if (dow === 0) continue; // Sunday = weekly off
        // Absence is only claimed inside the employee's working span
        // (first → last clock-in / roster date this month).
        const dayTime = dayDate.getTime();
        if (
          span.min === null ||
          span.max === null ||
          dayTime < span.min ||
          dayTime > span.max
        )
          continue;
        const dayLogs = logs.filter(
          (l) =>
            l.userId === u.id &&
            l.clockIn.getFullYear() === year &&
            l.clockIn.getMonth() === mIdx &&
            l.clockIn.getDate() === d,
        );
        const onLeave = (leaveByUser.get(u.id) || []).some(
          (lv) => dayDate >= lv.from && dayDate <= lv.to,
        );
        if (onLeave) {
          days.push({
            date: `${month}-${String(d).padStart(2, "0")}`,
            flag: LEAVE,
            clockIn: null,
            clockOut: null,
            minutes: 0,
          });
          continue;
        }
        const log = dayLogs[0];
        if (!log) {
          absent++;
          days.push({
            date: `${month}-${String(d).padStart(2, "0")}`,
            flag: ABSENT,
            clockIn: null,
            clockOut: null,
            minutes: 0,
          });
          continue;
        }
        const shift = shiftById.get(log.shiftId);
        const shiftStart = shift ? toMin(shift.startTime) : 0;
        const shiftEnd = shift ? toMin(shift.endTime) : 0;
        const clockInMin =
          log.clockIn.getHours() * 60 + log.clockIn.getMinutes();
        const isLate =
          log.status === "LATE" || clockInMin > shiftStart + graceMinutes;
        let flag = isLate ? LATE : PRESENT;
        let minutes = 0;
        if (isLate) {
          late++;
          minutes = clockInMin - shiftStart;
        } else {
          present++;
        }
        if (log.clockOut) {
          const clockOutMin =
            log.clockOut.getHours() * 60 + log.clockOut.getMinutes();
          if (shiftEnd > 0 && clockOutMin < shiftEnd - graceMinutes) {
            early++;
            flag = EARLY;
            minutes = shiftEnd - clockOutMin;
          }
        }
        days.push({
          date: `${month}-${String(d).padStart(2, "0")}`,
          flag,
          clockIn: log.clockIn,
          clockOut: log.clockOut,
          minutes,
        });
      }
      return {
        userId: u.id,
        name: u.name,
        employeeNumber: u.employeeNumber,
        counts: { present, late, early, absent },
        days,
      };
    });

    const otRegister = overtime.map((o) => ({
      id: o.id,
      date: o.date,
      hours: o.hours,
      userName: o.user?.name || o.userId,
      employeeNumber: o.user?.employeeNumber || null,
      approvedByName: o.approvedByName,
      approvedAt: o.approvedAt,
    }));
    const otTotals = {
      approvedCount: otRegister.length,
      approvedHours: Number(
        otRegister.reduce((sum, r) => sum + r.hours, 0).toFixed(2),
      ),
    };
    const grand = rows.reduce(
      (acc, r) => {
        acc.late += r.counts.late;
        acc.early += r.counts.early;
        acc.absent += r.counts.absent;
        acc.present += r.counts.present;
        return acc;
      },
      { late: 0, early: 0, absent: 0, present: 0 },
    );

    return NextResponse.json({
      month,
      rows,
      grand,
      otRegister,
      otTotals,
      shifts,
    });
  } catch (error) {
    console.error("GET /api/time-office error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
