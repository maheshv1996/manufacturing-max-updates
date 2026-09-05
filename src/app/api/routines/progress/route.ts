import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const userId = typeof body.userId === "string" ? body.userId : "";
    const stepId = typeof body.stepId === "string" ? body.stepId : "";
    const done = Boolean(body.done);

    if (!userId || !stepId) {
      return NextResponse.json(
        { error: "userId and stepId are required" },
        { status: 400 },
      );
    }

    // Must be authenticated and either mutating own progress or possess manager/admin rights
    if (!user.id && !user.isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.id !== userId && !user.isOwner && !canAny(user, ["ops.edit", "system.edit"])) {
      return NextResponse.json(
        { error: "Forbidden: cannot mutate another user's routine progress" },
        { status: 403 },
      );
    }

    const actor = user.name || user.id || userId;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    if (done) {
      // Upsert progress for today
      const progress = await prisma.$transaction(async (tx) => {
        const res = await tx.routineProgress.upsert({
          where: {
            userId_date_stepId: {
              userId,
              date: todayDate,
              stepId,
            },
          },
          update: {
            doneAt: new Date(),
          },
          create: {
            userId,
            date: todayDate,
            stepId,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "ROUTINE_PROGRESS_MARKED",
          entityType: "RoutineProgress",
          entityId: res.id,
          details: `user ${userId} · step ${stepId} · done`,
        });

        return res;
      });

      return NextResponse.json({ success: true, progress });
    } else {
      // Delete progress for today
      await prisma.$transaction(async (tx) => {
        await tx.routineProgress.deleteMany({
          where: {
            userId,
            date: todayDate,
            stepId,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "ROUTINE_PROGRESS_CLEARED",
          entityType: "RoutineProgress",
          details: `user ${userId} · step ${stepId} · cleared`,
        });
      });

      return NextResponse.json({ success: true });
    }
  } catch (error: unknown) {
    console.error("Routine progress API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
