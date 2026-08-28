import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

const DECISIONS = [
  "NO_ACTION",
  "WARNING",
  "FINAL_WARNING",
  "SUSPENSION",
  "TERMINATION",
];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = user.name || "Admin";
  try {
    const { id } = await params;
    const gate = await requireManagerLevel(user);
    if (!gate.ok)
      return NextResponse.json({ error: gate.error }, { status: 403 });
    const body = await req.json();
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );

    const theCase = await prisma.disciplinaryCase.findUnique({ where: { id } });
    if (!theCase)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    let result: any;
    if (action === "schedule-hearing") {
      if (theCase.stage !== "NOTICE")
        return NextResponse.json(
          { error: `Cannot schedule from stage ${theCase.stage}` },
          { status: 400 },
        );
      if (!data.hearingDate)
        return NextResponse.json(
          { error: "hearingDate required" },
          { status: 400 },
        );
      result = await prisma.disciplinaryCase.update({
        where: { id },
        data: { stage: "HEARING", hearingDate: new Date(data.hearingDate) },
      });
      await logAudit({
        actor,
        action: "DISCIPLINARY_HEARING_SCHEDULED",
        entityType: "DISCIPLINARY",
        entityId: id,
        details: `${theCase.caseNumber} · ${data.hearingDate}`,
      });
    } else if (action === "record-decision") {
      if (theCase.stage !== "HEARING")
        return NextResponse.json(
          { error: `Cannot record decision from stage ${theCase.stage}` },
          { status: 400 },
        );
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      if (!DECISIONS.includes(data.decision))
        return NextResponse.json(
          { error: `decision must be one of ${DECISIONS.join(", ")}` },
          { status: 400 },
        );
      result = await prisma.disciplinaryCase.update({
        where: { id },
        data: {
          stage: "DECISION",
          decision: data.decision,
          decisionNote: reason.reason,
          hearingHeldAt: new Date(),
          decidedBy: actor,
          decidedAt: new Date(),
        },
      });
      await logAudit({
        actor,
        action: "DISCIPLINARY_DECISION",
        entityType: "DISCIPLINARY",
        entityId: id,
        details: `${theCase.caseNumber} · ${data.decision} · ${(reason.reason || "").slice(0, 60)}`,
      });
    } else if (action === "close") {
      if (theCase.stage !== "DECISION")
        return NextResponse.json(
          { error: `Cannot close from stage ${theCase.stage}` },
          { status: 400 },
        );
      result = await prisma.disciplinaryCase.update({
        where: { id },
        data: { stage: "CLOSED", closedBy: actor, closedAt: new Date() },
      });
      await logAudit({
        actor,
        action: "DISCIPLINARY_CLOSED",
        entityType: "DISCIPLINARY",
        entityId: id,
        details: theCase.caseNumber,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("PATCH /api/disciplinary/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
