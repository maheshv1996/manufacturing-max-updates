import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["ops.edit", "maintenance.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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

    const actor = user.name || user.id || "Operator";

    const downtimeLog = await prisma.$transaction(async (tx) => {
      let reasonObj = await tx.downtimeReason.findFirst({
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

        reasonObj = await tx.downtimeReason.create({
          data: {
            code: codeStr,
            description: reason.trim(),
            category: validCategory,
          },
        });
      }

      const log = await tx.downtimeLog.create({
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

      await logAuditTx(tx, {
        actor,
        action: "DOWNTIME_LOGGED",
        entityType: "DowntimeLog",
        entityId: log.id,
        details: `machine ${machineId} · ${reasonObj.description} · ${durationMinutes ?? "ongoing"} min`,
      });

      return log;
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
