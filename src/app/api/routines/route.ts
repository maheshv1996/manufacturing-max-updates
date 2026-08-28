import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = (searchParams.get("role") || "OPERATOR") as any;
    const userId = searchParams.get("userId");

    const steps = await prisma.routineStep.findMany({
      where: { role: roleParam },
      orderBy: { seq: "asc" },
    });

    let completedStepIds: string[] = [];

    if (userId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const progress = await prisma.routineProgress.findMany({
        where: {
          userId,
          date: { gte: todayStart, lte: todayEnd },
        },
      });

      completedStepIds = progress.map((p) => p.stepId);
    }

    return NextResponse.json({ steps, completedStepIds });
  } catch (error: any) {
    console.error("Fetch routines error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "reorder") {
      const { role, steps } = body; // Array of { id, seq }
      for (const item of steps) {
        await prisma.routineStep.update({
          where: { id: item.id },
          data: { seq: item.seq },
        });
      }

      await logAudit({
        actor: "system",
        action: "ROUTINE_STEPS_REORDERED",
        entityType: "RoutineStep",
        details: `role=${role} · ${steps.length} steps`,
      });

      return NextResponse.json({ success: true });
    }

    if (action === "create") {
      const { role, title, target, timeLabel } = body;
      const count = await prisma.routineStep.count({ where: { role } });
      const newStep = await prisma.routineStep.create({
        data: {
          role,
          seq: count + 1,
          title,
          target,
          timeLabel: timeLabel || null,
        },
      });

      await logAudit({
        actor: "system",
        action: "ROUTINE_STEP_CREATED",
        entityType: "RoutineStep",
        entityId: newStep.id,
        details: `${role} · ${title}`,
      });

      return NextResponse.json(newStep);
    }

    if (action === "update") {
      const { id, title, target, timeLabel } = body;
      const updatedStep = await prisma.routineStep.update({
        where: { id },
        data: {
          title,
          target,
          timeLabel: timeLabel || null,
        },
      });

      await logAudit({
        actor: "system",
        action: "ROUTINE_STEP_UPDATED",
        entityType: "RoutineStep",
        entityId: id,
        details: `${title} · ${target}`,
      });

      return NextResponse.json(updatedStep);
    }

    if (action === "delete") {
      const { id } = body;
      await prisma.routineStep.delete({ where: { id } });

      await logAudit({
        actor: "system",
        action: "ROUTINE_STEP_DELETED",
        entityType: "RoutineStep",
        entityId: id,
        details: `deleted step ${id}`,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Admin routines API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
