import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

function withEffectiveness(programs: any[]) {
  let totAttended = 0,
    totPassed = 0,
    totScored = 0;
  const enriched = programs.map((p: any) => {
    const scored = p.attendees.filter(
      (a: any) => a.score !== null && a.score !== undefined,
    );
    const passed = scored.filter((a: any) => a.status === "PASSED");
    const effectiveness =
      scored.length > 0 ? Math.round((passed.length / scored.length) * 100) : 0;
    totAttended += p.attendees.length;
    totPassed += passed.length;
    totScored += scored.length;
    return { ...p, effectiveness, scoredCount: scored.length };
  });
  return {
    programs: enriched,
    overall: {
      programs: enriched.length,
      attended: totAttended,
      scored: totScored,
      passed: totPassed,
      effectiveness:
        totScored > 0 ? Math.round((totPassed / totScored) * 100) : 0,
    },
  };
}

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, ["people.view", "people.edit", "system.edit"]) ||
      user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const programs = await prisma.trainingProgram.findMany({
      include: {
        attendees: {
          include: {
            user: { select: { id: true, name: true, employeeNumber: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { scheduledDate: "desc" },
      take: 200,
    });
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, employeeNumber: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ...withEffectiveness(programs), users });
  } catch (error) {
    console.error("GET /api/training error:", error);
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
  const actor = user.name || "Admin";
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
    let result: any;

    const gate = await requireManagerLevel(user);
    const canEdit = gate.ok || canAny(user, ["people.edit"]);

    if (action === "create-program") {
      if (!canEdit)
        return NextResponse.json(
          { error: gate.ok ? gate.error : "Requires manager or people.edit" },
          { status: 403 },
        );
      const { title, category, trainer, scheduledDate, passingScore, notes } =
        data;
      if (!title || !category || !scheduledDate)
        return NextResponse.json(
          { error: "title, category and scheduledDate required" },
          { status: 400 },
        );
      const score =
        passingScore !== undefined && passingScore !== null
          ? Number(passingScore)
          : 70;
      if (!(score > 0 && score <= 100))
        return NextResponse.json(
          { error: "passingScore must be 1–100" },
          { status: 400 },
        );
      const number = await nextSeqNumber(
        "trainingProgram",
        "programNumber",
        "TRN",
        new Date(scheduledDate),
      );
      result = await prisma.trainingProgram.create({
        data: {
          programNumber: number,
          title,
          category,
          trainer: trainer || null,
          scheduledDate: new Date(scheduledDate),
          passingScore: score,
          notes: notes || null,
        },
      });
      await logAudit({
        actor,
        action: "TRAINING_CREATED",
        entityType: "TRAINING_PROGRAM",
        entityId: result.id,
        details: `${number} · ${title}`,
      });
    } else if (action === "add-attendee") {
      if (!canEdit)
        return NextResponse.json(
          { error: gate.ok ? gate.error : "Requires manager or people.edit" },
          { status: 403 },
        );
      const { programId, userId } = data;
      const program = await prisma.trainingProgram.findUnique({
        where: { id: programId },
      });
      if (!program)
        return NextResponse.json(
          { error: "Program not found" },
          { status: 404 },
        );
      const existing = await prisma.trainingAttendance.findUnique({
        where: { programId_userId: { programId, userId } },
      });
      if (existing)
        return NextResponse.json(
          { error: "Attendee already on the program" },
          { status: 400 },
        );
      result = await prisma.trainingAttendance.create({
        data: { programId, userId },
      });
      await logAudit({
        actor,
        action: "TRAINING_ATTENDEE_ADDED",
        entityType: "TRAINING_PROGRAM",
        entityId: program.id,
        details: `${program.programNumber} + user ${userId}`,
      });
    } else if (action === "remove-attendee") {
      if (!canEdit)
        return NextResponse.json(
          { error: gate.ok ? gate.error : "Requires manager or people.edit" },
          { status: 403 },
        );
      const { programId, userId } = data;
      await prisma.trainingAttendance
        .delete({ where: { programId_userId: { programId, userId } } })
        .catch(() => null);
      result = { programId, userId };
      await logAudit({
        actor,
        action: "TRAINING_ATTENDEE_REMOVED",
        entityType: "TRAINING_PROGRAM",
        entityId: programId,
        details: `user ${userId}`,
      });
    } else if (action === "mark-attended") {
      if (!canEdit)
        return NextResponse.json(
          { error: gate.ok ? gate.error : "Requires manager or people.edit" },
          { status: 403 },
        );
      const { programId, userId } = data;
      const rec = await prisma.trainingAttendance.findUnique({
        where: { programId_userId: { programId, userId } },
      });
      if (!rec)
        return NextResponse.json(
          { error: "Attendee not found on this program" },
          { status: 404 },
        );
      if (rec.status !== "SCHEDULED")
        return NextResponse.json(
          { error: "Only SCHEDULED attendees can be marked attended" },
          { status: 400 },
        );
      result = await prisma.trainingAttendance.update({
        where: { id: rec.id },
        data: { status: "ATTENDED" },
      });
      await logAudit({
        actor,
        action: "TRAINING_ATTENDED",
        entityType: "TRAINING_PROGRAM",
        entityId: programId,
        details: `user ${userId}`,
      });
    } else if (action === "record-score") {
      if (!canEdit)
        return NextResponse.json(
          { error: gate.ok ? gate.error : "Requires manager or people.edit" },
          { status: 403 },
        );
      const { programId, userId, score } = data;
      const s = Number(score);
      if (!(s >= 0 && s <= 100))
        return NextResponse.json(
          { error: "score must be 0–100" },
          { status: 400 },
        );
      const program = await prisma.trainingProgram.findUnique({
        where: { id: programId },
      });
      if (!program)
        return NextResponse.json(
          { error: "Program not found" },
          { status: 404 },
        );
      const rec = await prisma.trainingAttendance.findUnique({
        where: { programId_userId: { programId, userId } },
      });
      if (!rec)
        return NextResponse.json(
          { error: "Attendee not on this program" },
          { status: 404 },
        );
      if (rec.status === "PASSED" || rec.status === "FAILED")
        return NextResponse.json(
          { error: "Check already recorded" },
          { status: 400 },
        );
      const status = s >= program.passingScore ? "PASSED" : "FAILED";
      result = await prisma.trainingAttendance.update({
        where: { id: rec.id },
        data: { score: s, status, checkedAt: new Date(), checkedBy: actor },
      });
      await logAudit({
        actor,
        action: "TRAINING_CHECK_RECORDED",
        entityType: "TRAINING_PROGRAM",
        entityId: program.id,
        details: `${program.programNumber} · user ${userId} · ${s}% → ${status} (pass ≥ ${program.passingScore})`,
      });
      // The post-training check closes the record: once every attendee is decided,
      // the program itself closes as COMPLETED.
      const open = await prisma.trainingAttendance.count({
        where: { programId, status: { in: ["SCHEDULED", "ATTENDED"] } },
      });
      if (open === 0 && program.status === "PLANNED") {
        await prisma.trainingProgram.update({
          where: { id: program.id },
          data: { status: "COMPLETED" },
        });
        await logAudit({
          actor,
          action: "TRAINING_COMPLETED",
          entityType: "TRAINING_PROGRAM",
          entityId: program.id,
          details: program.programNumber,
        });
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/training error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
