import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { machineId, category, reason, startedAt, endedAt, notes } = body;

    if (!machineId || !category || !reason || !startedAt) {
      return NextResponse.json(
        { error: "Machine, Category, Reason, and Started At are required." },
        { status: 400 },
      );
    }

    const startDate = new Date(startedAt);
    let endDate: Date | null = null;
    let durationMinutes: number | null = null;

    if (endedAt && endedAt.trim() !== "") {
      endDate = new Date(endedAt);
      const diffMs = endDate.getTime() - startDate.getTime();
      durationMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
    }

    let reasonObj = await prisma.downtimeReason.findFirst({
      where: { description: reason.trim() },
    });

    if (!reasonObj) {
      const categoryUpper = category.toUpperCase();
      const validCategory = [
        "MECHANICAL",
        "ELECTRICAL",
        "MATERIAL",
        "QUALITY",
        "OPERATOR",
      ].includes(categoryUpper)
        ? (categoryUpper as any)
        : "MECHANICAL";

      const codeStr = `D-${categoryUpper.slice(0, 4)}-${Date.now()
        .toString()
        .slice(-4)}`;

      reasonObj = await prisma.downtimeReason.create({
        data: {
          code: codeStr,
          description: reason.trim(),
          category: validCategory,
        },
      });
    }

    const downtimeLog = await prisma.downtimeLog.create({
      data: {
        machineId,
        reasonId: reasonObj.id,
        startTime: startDate,
        endTime: endDate,
        durationMinutes,
        notes: notes ? notes.trim() : null,
      },
      include: {
        machine: {
          select: {
            name: true,
            code: true,
          },
        },
        reason: true,
      },
    });

    await logAudit({
      actor: "system",
      action: "DOWNTIME_LOGGED",
      entityType: "DowntimeLog",
      entityId: downtimeLog.id,
      details: `machine ${machineId} · ${reasonObj.description} · ${durationMinutes ?? "ongoing"} min`,
    });

    return NextResponse.json(downtimeLog, { status: 201 });
  } catch (error) {
    console.error("Error logging downtime event:", error);
    return NextResponse.json(
      { error: "Failed to log downtime event." },
      { status: 500 },
    );
  }
}
