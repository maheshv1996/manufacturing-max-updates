import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { operatorId, shiftId, action, clientId } = body;

    const trimmedClientId: string | null = clientId ? String(clientId).trim() : null;
    if (trimmedClientId) {
      const dup = await checkIdempotency(trimmedClientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Attendance action already processed (idempotent)" });
      }
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
      // Atomic CLOCK_IN with idempotency + race guard
      const newLog = await prisma.$transaction(async (tx) => {
        if (trimmedClientId) {
          const reserved = await reserveIdempotency(tx as any, trimmedClientId, "/api/attendance/clock:CLOCK_IN");
          if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
        }

        const existingOpenTx = await (tx as any).attendanceLog.findFirst({
          where: { userId: operatorId, clockOut: null, clockIn: { gte: todayStart } },
        });
        if (existingOpenTx) {
          throw Object.assign(new Error("ALREADY_CLOCKED_IN"), { code: "ALREADY_CLOCKED_IN", log: existingOpenTx });
        }

        const graceSettingTx = await (tx as any).setting.findUnique({ where: { key: "attendance_grace_minutes" } });
        const graceMinsTx = parseInt(graceSettingTx?.value || "10", 10);
        let statusTx: "PRESENT" | "LATE" = "PRESENT";
        if (shift) {
          const nowTx = new Date();
          const [startH, startM] = shift.startTime.split(":").map(Number);
          const shiftStartCutoff = new Date(nowTx);
          shiftStartCutoff.setHours(startH, startM + graceMinsTx, 0, 0);
          if (nowTx > shiftStartCutoff) statusTx = "LATE";
        }

        const created = await (tx as any).attendanceLog.create({
          data: { userId: operatorId, shiftId: resolvedShiftId, clockIn: new Date(), status: statusTx },
          include: { shift: true, user: true },
        });

        await (tx as any).auditLog.create({
          data: {
            actor: "system",
            action: "CLOCK_IN",
            entityType: "AttendanceLog",
            entityId: created.id,
            details: `operator ${operatorId} · shift ${resolvedShiftId} · ${statusTx}`,
          },
        });
        return created;
      }).catch((e: any) => {
        if (e?.code === "ALREADY_CLOCKED_IN") throw e;
        if (e?.code === "DUPLICATE") throw e;
        throw e;
      });

      if (trimmedClientId) await completeIdempotency(trimmedClientId, newLog);
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

      const updatedLog = await prisma.$transaction(async (tx) => {
        if (trimmedClientId) {
          const reserved = await reserveIdempotency(tx as any, trimmedClientId, "/api/attendance/clock:CLOCK_OUT");
          if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
        }
        // Re-validate inside tx to avoid double CLOCK_OUT race
        const freshOpen = await (tx as any).attendanceLog.findUnique({ where: { id: openLog.id } });
        if (!freshOpen || freshOpen.clockOut) {
          throw Object.assign(new Error("ALREADY_CLOCKED_OUT"), { code: "ALREADY_CLOCKED_OUT" });
        }
        const updated = await (tx as any).attendanceLog.update({
          where: { id: openLog.id },
          data: { clockOut: new Date() },
          include: { shift: true, user: true },
        });
        await (tx as any).auditLog.create({
          data: { actor: "system", action: "CLOCK_OUT", entityType: "AttendanceLog", entityId: updated.id, details: `operator ${operatorId}` },
        });
        return updated;
      });

      if (trimmedClientId) await completeIdempotency(trimmedClientId, updatedLog);
      return NextResponse.json(updatedLog);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error?.code === "DUPLICATE") {
      return NextResponse.json({ success: true, duplicate: true, message: "Attendance action already processed (idempotent)" });
    }
    if (error?.code === "ALREADY_CLOCKED_IN") {
      return NextResponse.json({ error: "Operator is already clocked in today.", log: error.log }, { status: 400 });
    }
    if (error?.code === "ALREADY_CLOCKED_OUT") {
      return NextResponse.json({ error: "No active clock-in log found for operator." }, { status: 404 });
    }
    console.error("Attendance clock error:", error);
    return NextResponse.json({ error: "Failed to process attendance" }, { status: 500 });
  }
}
