import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { buildMrmAgenda } from "@/lib/mrmAgenda";
import { currentPeriod } from "@/lib/qualityObjectives";

export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isOwner && !canAny(user, ["quality.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const meetings = await prisma.mrmMeeting.findMany({
      include: { actionItems: { orderBy: { createdAt: "desc" } } },
      orderBy: { date: "desc" },
    });
    // Agenda preview for the "start a new meeting" modal — always fresh.
    const agenda = await buildMrmAgenda();
    return NextResponse.json({ meetings, agenda, period: currentPeriod() });
  } catch (error) {
    console.error("GET /api/mrm error:", error);
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

  // All MRM mutations are manager decisions (ISO 9001 cl.9.3 ownership).
  const gate = await requireManagerLevel(user);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }
  if (!canAny(user, ["quality.edit", "system.edit"]) && !user.isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    let result: any;

    if (action === "create") {
      const { title, date, attendees } = data;
      if (!title || !date)
        return NextResponse.json(
          { error: "title and date required" },
          { status: 400 },
        );
      const attendeesList =
        Array.isArray(attendees) && attendees.length
          ? attendees.map((a: any) => (typeof a === "string" ? { name: a } : a))
          : [{ name: user.name || "Management" }];
      const count = await prisma.mrmMeeting.count();
      const meetingNumber = `MRM-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
      const agenda = await buildMrmAgenda();
      result = await prisma.mrmMeeting.create({
        data: {
          meetingNumber,
          title,
          date: new Date(date),
          attendees: attendeesList,
          agenda,
          minutesBy: user.name || "Management",
          status: "OPEN",
        },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "MRM_CREATED",
        entityType: "MRM_MEETING",
        entityId: result.id,
        details: `Opened ${meetingNumber} — ${title} (${agenda.length} agenda items auto-pulled)`,
      });
    } else if (action === "close") {
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const { id, summary, decisions } = data;
      const meeting = await prisma.mrmMeeting.findUnique({ where: { id } });
      if (!meeting)
        return NextResponse.json(
          { error: "Meeting not found" },
          { status: 404 },
        );
      if (meeting.status === "CLOSED")
        return NextResponse.json(
          { error: "Meeting already closed" },
          { status: 400 },
        );

      result = await prisma.mrmMeeting.update({
        where: { id },
        data: {
          status: "CLOSED",
          summary: summary || meeting.summary || reason.reason,
          decisions:
            Array.isArray(decisions) && decisions.length
              ? decisions.map((d: any) =>
                  typeof d === "string" ? { text: d } : d,
                )
              : (meeting.decisions as any[]) || [],
          closedByName: user.name || "Management",
          closedAt: new Date(),
        },
      });

      // Auto-escalate any still-OPEN action items that are overdue — they survived the review.
      const overdue = await prisma.mrmActionItem.findMany({
        where: { meetingId: id, status: "OPEN", dueDate: { lt: new Date() } },
      });
      for (const a of overdue) {
        const existing = await prisma.escalation.findFirst({
          where: {
            sourceType: "MRM_ACTION",
            sourceId: a.id,
            status: { not: "RESOLVED" },
          },
        });
        if (!existing) {
          await prisma.escalation.create({
            data: {
              sourceType: "MRM_ACTION",
              sourceId: a.id,
              title: `Overdue MRM action · ${a.description.slice(0, 80)}`,
              severity:
                a.priority === "HIGH"
                  ? "CRITICAL"
                  : a.priority === "MEDIUM"
                    ? "HIGH"
                    : "MEDIUM",
              dueDate: a.dueDate,
              notes: `Action item from ${meeting.meetingNumber} remained open past its due date — escalated at meeting close by ${user.name}.`,
              escalatedAt: new Date(),
            },
          });
          await prisma.mrmActionItem.update({
            where: { id: a.id },
            data: { escalated: true },
          });
        }
      }
      await logAudit({
        actor: user.name || "Admin",
        action: "MRM_CLOSED",
        entityType: "MRM_MEETING",
        entityId: id,
        details: `Closed ${meeting.meetingNumber} — ${overdue.length} overdue action(s) auto-escalated (${reason.reason})`,
      });
    } else if (action === "addAction") {
      const { meetingId, description, ownerName, dueDate, priority } = data;
      if (!meetingId || !description || !ownerName) {
        return NextResponse.json(
          { error: "meetingId, description and ownerName required" },
          { status: 400 },
        );
      }
      const meeting = await prisma.mrmMeeting.findUnique({
        where: { id: meetingId },
      });
      if (!meeting)
        return NextResponse.json(
          { error: "Meeting not found" },
          { status: 404 },
        );
      if (meeting.status === "CLOSED")
        return NextResponse.json(
          { error: "Meeting closed — action items cannot be added" },
          { status: 400 },
        );
      result = await prisma.mrmActionItem.create({
        data: {
          meetingId,
          description,
          ownerName,
          dueDate: dueDate ? new Date(dueDate) : null,
          priority: priority || "MEDIUM",
        },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "MRM_ACTION_ADDED",
        entityType: "MRM_ACTION",
        entityId: result.id,
        details: `${description.slice(0, 100)} → ${ownerName}${dueDate ? ` by ${new Date(dueDate).toLocaleDateString()}` : ""}`,
      });
    } else if (action === "completeAction") {
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const item = await prisma.mrmActionItem.findUnique({
        where: { id: data.actionId },
      });
      if (!item)
        return NextResponse.json(
          { error: "Action item not found" },
          { status: 404 },
        );
      result = await prisma.mrmActionItem.update({
        where: { id: data.actionId },
        data: { status: "DONE" },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "MRM_ACTION_COMPLETED",
        entityType: "MRM_ACTION",
        entityId: item.id,
        details: `${item.description.slice(0, 100)} (${reason.reason})`,
      });
    } else if (action === "escalateAction") {
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const item = await prisma.mrmActionItem.findUnique({
        where: { id: data.actionId },
        include: { meeting: true },
      });
      if (!item)
        return NextResponse.json(
          { error: "Action item not found" },
          { status: 404 },
        );
      const existing = await prisma.escalation.findFirst({
        where: {
          sourceType: "MRM_ACTION",
          sourceId: item.id,
          status: { not: "RESOLVED" },
        },
      });
      if (existing)
        return NextResponse.json({
          success: true,
          record: existing,
          deduped: true,
        });
      result = await prisma.escalation.create({
        data: {
          sourceType: "MRM_ACTION",
          sourceId: item.id,
          title: `MRM action escalated · ${item.description.slice(0, 80)}`,
          severity:
            item.priority === "HIGH"
              ? "CRITICAL"
              : item.priority === "MEDIUM"
                ? "HIGH"
                : "MEDIUM",
          dueDate: item.dueDate,
          notes: `${reason.reason} (from ${item.meeting.meetingNumber})`,
          escalatedAt: new Date(),
        },
      });
      await prisma.mrmActionItem.update({
        where: { id: item.id },
        data: { escalated: true },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "MRM_ACTION_ESCALATED",
        entityType: "MRM_ACTION",
        entityId: item.id,
        details: `${item.description.slice(0, 100)} → escalation ${result.id}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/mrm error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
