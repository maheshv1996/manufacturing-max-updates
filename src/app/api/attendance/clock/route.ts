import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const processedClockClientIds = new Set<string>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { operatorId, shiftId, action, clientId } = body;

    if (clientId && processedClockClientIds.has(clientId)) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Attendance action already processed (idempotent)",
      });
    }
    if (clientId) {
      processedClockClientIds.add(clientId);
    }

    if (!operatorId || !action) {
      return NextResponse.json(
        { error: "Operator ID and action are required" },
        { status: 400 },
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (action === "CLOCK_IN") {
      let resolvedShiftId = shiftId;
      let shift = null;

      if (resolvedShiftId) {
        shift = await prisma.shift.findUnique({
          where: { id: resolvedShiftId },
        });
      }

      if (!shift) {
        const shifts = await prisma.shift.findMany({
          where: { isActive: true },
        });
        const now = new Date();
        const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        shift =
          shifts.find((s) => {
            if (s.startTime <= s.endTime) {
              return nowStr >= s.startTime && nowStr <= s.endTime;
            } else {
              // Overnight shift (e.g. 22:00 to 06:00)
              return nowStr >= s.startTime || nowStr <= s.endTime;
            }
          }) ||
          shifts[0] ||
          null;

        if (shift) {
          resolvedShiftId = shift.id;
        }
      }

      if (!resolvedShiftId || !shift) {
        return NextResponse.json(
          {
            error:
              "No active shifts found in system. Please configure shifts in Admin.",
          },
          { status: 400 },
        );
      }

      // Check if already clocked in today without clocking out
      const existingOpen = await prisma.attendanceLog.findFirst({
        where: {
          userId: operatorId,
          clockOut: null,
          clockIn: { gte: todayStart },
        },
      });

      if (existingOpen) {
        return NextResponse.json(
          { error: "Operator is already clocked in today.", log: existingOpen },
          { status: 400 },
        );
      }

      // Fetch grace minutes setting
      const graceSetting = await prisma.setting.findUnique({
        where: { key: "attendance_grace_minutes" },
      });
      const graceMins = parseInt(graceSetting?.value || "10", 10);

      let status: "PRESENT" | "LATE" = "PRESENT";

      if (shift) {
        const now = new Date();
        const [startH, startM] = shift.startTime.split(":").map(Number);
        const shiftStartCutoff = new Date(now);
        shiftStartCutoff.setHours(startH, startM + graceMins, 0, 0);

        if (now > shiftStartCutoff) {
          status = "LATE";
        }
      }

      const newLog = await prisma.attendanceLog.create({
        data: {
          userId: operatorId,
          shiftId: resolvedShiftId,
          clockIn: new Date(),
          status,
        },
        include: {
          shift: true,
          user: true,
        },
      });

      await logAudit({
        actor: "system",
        action: "CLOCK_IN",
        entityType: "AttendanceLog",
        entityId: newLog.id,
        details: `operator ${operatorId} · shift ${resolvedShiftId} · ${status}`,
      });

      return NextResponse.json(newLog);
    }

    if (action === "CLOCK_OUT") {
      const openLog = await prisma.attendanceLog.findFirst({
        where: {
          userId: operatorId,
          clockOut: null,
        },
        orderBy: { clockIn: "desc" },
      });

      if (!openLog) {
        return NextResponse.json(
          { error: "No active clock-in log found for operator." },
          { status: 404 },
        );
      }

      const updatedLog = await prisma.attendanceLog.update({
        where: { id: openLog.id },
        data: {
          clockOut: new Date(),
        },
        include: {
          shift: true,
          user: true,
        },
      });

      await logAudit({
        actor: "system",
        action: "CLOCK_OUT",
        entityType: "AttendanceLog",
        entityId: updatedLog.id,
        details: `operator ${operatorId}`,
      });

      return NextResponse.json(updatedLog);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Attendance clock error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
