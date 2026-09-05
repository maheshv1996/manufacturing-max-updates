import { logAuditTx } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const deviceKey = req.headers.get("x-device-key");
    if (!deviceKey) {
      return NextResponse.json(
        { error: "Missing X-Device-Key header" },
        { status: 401 },
      );
    }

    const device = await prisma.attendanceDevice.findUnique({
      where: { endpointKey: deviceKey },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Invalid device key" },
        { status: 401 },
      );
    }

    if (!device.isActive) {
      return NextResponse.json(
        { error: "Inactive device: Forbidden" },
        { status: 403 },
      );
    }

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { employeeNumber, timestamp, event } = body;

    if (!employeeNumber || !event) {
      return NextResponse.json(
        { error: "Missing required fields: employeeNumber, event (IN|OUT)" },
        { status: 400 },
      );
    }

    if (!["IN", "OUT"].includes(event)) {
      return NextResponse.json(
        { error: "Event must be IN or OUT" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { employeeNumber },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const punchTime = timestamp ? new Date(timestamp) : new Date();

    // Get the active shift for this time
    const shiftId = await getActiveShiftId(punchTime);

    await prisma.$transaction(async (tx) => {
      const log = await tx.attendanceLog.create({
        data: {
          userId: user.id,
          shiftId,
          clockIn: event === "IN" ? punchTime : undefined,
          clockOut: event === "OUT" ? punchTime : undefined,
        },
      });

      await tx.attendanceDevice.update({
        where: { id: device.id },
        data: { lastSeen: new Date() },
      });

      await logAuditTx(tx, {
        actor: device.name || "Device",
        action: "DEVICE_PUNCH",
        entityType: "AttendanceLog",
        entityId: log.id,
        details: `Employee ${employeeNumber} punch ${event} via device ${device.name || device.id}`,
      });
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (e) {
    console.error("[device-punch] error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function getActiveShiftId(at: Date): Promise<string> {
  const dayStart = new Date(at);
  dayStart.setHours(0, 0, 0, 0);

  const roster = await prisma.shiftRoster.findFirst({
    where: {
      weekStart: { lte: dayStart },
      status: "PUBLISHED",
    },
    orderBy: { weekStart: "desc" },
    include: {
      entries: {
        where: { date: dayStart },
        take: 1,
      },
    },
  });

  if (roster?.entries?.length) {
    return roster.entries[0].shiftId;
  }

  const defaultShift = await prisma.shift.findFirst({
    where: { isActive: true },
  });
  return defaultShift?.id || "default-shift";
}
