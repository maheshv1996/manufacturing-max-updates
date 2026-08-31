import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import {
  requireManagerLevel,
  validateReason,
  auditDecision,
} from "@/lib/managerGate";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
    await logAudit({ actor: "system", action: "LEAVE_STATUS_UPDATED", entityType: "LeaveRequest", details: "Leave request status updated" });
  try {
    const { id } = await props.params;
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !can(user, "people.edit") &&
      !can(user, "system.edit") &&
      !user.isOwner
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { status, note } = body;

    if (!status || !["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Verify permissions for editing
    if (
      status !== "PENDING" &&
      !can(user, "people.edit") &&
      !can(user, "system.edit") &&
      !user.isOwner
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Approving / rejecting a leave is a decision — department-head level + reason.
    if (status !== "PENDING") {
      const gate = await requireManagerLevel(user);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: 403 });
      }
      const reasonCheck = validateReason(body);
      if (!reasonCheck.ok) {
        return NextResponse.json({ error: reasonCheck.error }, { status: 400 });
      }
      body.note = reasonCheck.reason;
    }

    // P24 — MINIMUM-STAFFING guard: approving a leave must not understaff a rostered shift.
    if (status === "APPROVED") {
      const leaveRow = await prisma.leaveRequest.findUnique({ where: { id } });
      if (leaveRow) {
        const { startOfWeek, addDays, isSameDay, format } =
          await import("date-fns");
        const settings = await prisma.setting.findUnique({
          where: { key: "minStaffingPerShift" },
        });
        const min =
          settings && settings.value ? parseInt(settings.value, 10) : 2;
        const from = new Date(leaveRow.fromDate);
        const to = new Date(leaveRow.toDate);
        let day = startOfWeek(from, { weekStartsOn: 1 });
        const weekStart = startOfWeek(from, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 7);
        const roster = await prisma.shiftRoster.findUnique({
          where: { weekStart },
          include: {
            entries: {
              include: { shift: { select: { id: true, name: true } } },
            },
          },
        });
        const blocks: string[] = [];
        if (roster) {
          while (day <= to) {
            if (day < weekStart || day >= weekEnd) {
              day = addDays(day, 1);
              continue;
            }
            for (const e of roster.entries) {
              if (
                e.userId !== leaveRow.userId ||
                !isSameDay(new Date(e.date), day)
              )
                continue;
              const remaining = roster.entries.filter(
                (x) =>
                  x.shiftId === e.shiftId &&
                  isSameDay(new Date(x.date), day) &&
                  x.userId !== leaveRow.userId,
              ).length;
              if (remaining < min) {
                blocks.push(
                  `${e.shift.name} on ${format(day, "dd MMM")} (would drop to ${remaining}, min ${min})`,
                );
              }
            }
            day = addDays(day, 1);
          }
        }
        if (blocks.length > 0) {
          return NextResponse.json(
            {
              error: `MINIMUM-STAFFING BLOCKED: approving this leave understaffs ${blocks.slice(0, 3).join(", ")}${blocks.length > 3 ? ` (+${blocks.length - 3} more)` : ""}.`,
            },
            { status: 400 },
          );
        }
      }
    }

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedAt: status === "APPROVED" ? new Date() : null,
        approvedById: status === "APPROVED" ? user.id : null,
        note,
      },
    });

    if (status === "APPROVED") {
      await auditDecision({
        actor: user.name,
        action: "LEAVE",
        entityType: "LeaveRequest",
        entityId: leave.id,
        reason: note || "",
      });
    } else if (status === "REJECTED") {
      await prisma.auditLog.create({
        data: {
          action: "LEAVE_REJECTED",
          entityType: "LeaveRequest",
          entityId: leave.id,
          details: note || "",
          actor: user.name,
        },
      });
    }

    return NextResponse.json(leave);
  } catch (error) {
    console.error("Error updating leave:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
