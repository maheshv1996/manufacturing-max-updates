import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { userId, stepId, done } = body;

    if (!userId || !stepId) {
      return NextResponse.json(
        { error: "userId and stepId are required" },
        { status: 400 },
      );
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    if (done) {
      // Upsert progress for today
      const progress = await prisma.routineProgress.upsert({
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

      await logAudit({
        actor: "system",
        action: "ROUTINE_PROGRESS_MARKED",
        entityType: "RoutineProgress",
        entityId: progress.id,
        details: `user ${userId} · step ${stepId} · done`,
      });

      return NextResponse.json({ success: true, progress });
    } else {
      // Delete progress for today
      await prisma.routineProgress.deleteMany({
        where: {
          userId,
          date: todayDate,
          stepId,
        },
      });

      await logAudit({
        actor: "system",
        action: "ROUTINE_PROGRESS_CLEARED",
        entityType: "RoutineProgress",
        details: `user ${userId} · step ${stepId} · cleared`,
      });

      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    console.error("Routine progress API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
