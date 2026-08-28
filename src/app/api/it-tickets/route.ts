import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

// M31 — SLA hours by priority: CRITICAL 4h, HIGH 8h, MEDIUM 24h, LOW 72h.
export const SLA_HOURS: Record<string, number> = {
  LOW: 72,
  MEDIUM: 24,
  HIGH: 8,
  CRITICAL: 4,
};
const CATEGORIES = [
  "HARDWARE",
  "SOFTWARE",
  "NETWORK",
  "ACCESS",
  "ACCOUNT",
  "OTHER",
];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function slaStatus(ticket: any, now: Date = new Date()) {
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED")
    return { status: "MET", overdue: false };
  const overdue = new Date(ticket.slaDueAt).getTime() < now.getTime();
  const hoursLeft =
    Math.round(
      ((new Date(ticket.slaDueAt).getTime() - now.getTime()) / 3600000) * 10,
    ) / 10;
  return { status: overdue ? "OVERDUE" : "ON_TRACK", overdue, hoursLeft };
}

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate = canAny(user, ["system.view", "system.edit"]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [tickets, users] = await Promise.all([
      prisma.itTicket.findMany({
        include: {
          raisedBy: { select: { name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: [{ status: "asc" }, { slaDueAt: "asc" }],
        take: 500,
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, employeeNumber: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const now = new Date();
    const withSla = tickets.map((t) => ({ ...t, sla: slaStatus(t, now) }));
    const stats = {
      open: tickets.filter((t) => t.status === "OPEN").length,
      inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
      overdue: withSla.filter((t) => t.sla.overdue).length,
      resolved: tickets.filter((t) => t.status === "RESOLVED").length,
      criticalOpen: tickets.filter(
        (t) =>
          t.priority === "CRITICAL" &&
          t.status !== "CLOSED" &&
          t.status !== "RESOLVED",
      ).length,
    };
    return NextResponse.json({
      tickets: withSla,
      users,
      stats,
      categories: CATEGORIES,
      priorities: PRIORITIES,
      slaHours: SLA_HOURS,
    });
  } catch (error) {
    console.error("GET /api/it-tickets error:", error);
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
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["system.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager or system.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-ticket") {
      const { title, category, priority, assignedToId } = data;
      if (!title)
        return NextResponse.json({ error: "title required" }, { status: 400 });
      const prio = PRIORITIES.includes(priority) ? priority : "MEDIUM";
      const ticketNumber = await nextSeqNumber(
        "itTicket",
        "ticketNumber",
        "ITK",
      );
      const raisedAt = new Date();
      result = await prisma.itTicket.create({
        data: {
          ticketNumber,
          title,
          category: CATEGORIES.includes(category) ? category : "OTHER",
          priority: prio as any,
          raisedById: user.id,
          assignedToId: assignedToId || null,
          raisedAt,
          slaDueAt: new Date(raisedAt.getTime() + SLA_HOURS[prio] * 3600000),
        },
        include: {
          raisedBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      });
      await logAudit({
        actor,
        action: "IT_TICKET_CREATED",
        entityType: "IT_TICKET",
        entityId: result.id,
        details: `${ticketNumber} · ${title} · ${prio} · SLA ${SLA_HOURS[prio]}h`,
      });
    } else if (action === "update-ticket") {
      const t = await prisma.itTicket.findUnique({ where: { id: data.id } });
      if (!t)
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.title !== undefined) patch.title = data.title;
      if (data.category !== undefined)
        patch.category = CATEGORIES.includes(data.category)
          ? data.category
          : t.category;
      if (data.assignedToId !== undefined)
        patch.assignedToId = data.assignedToId || null;
      if (data.priority !== undefined && PRIORITIES.includes(data.priority)) {
        patch.priority = data.priority;
        if (t.status !== "RESOLVED" && t.status !== "CLOSED") {
          patch.slaDueAt = new Date(
            new Date(t.raisedAt).getTime() + SLA_HOURS[data.priority] * 3600000,
          );
        }
      }
      if (
        data.status !== undefined &&
        ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(data.status)
      ) {
        patch.status = data.status;
        if (data.status === "RESOLVED") patch.resolvedAt = new Date();
        if (data.status === "CLOSED") {
          patch.closedAt = new Date();
          patch.resolvedAt = patch.resolvedAt || new Date();
        }
        if (data.status === "OPEN") patch.resolvedAt = null;
      }
      if (data.resolution !== undefined)
        patch.resolution = data.resolution || null;
      result = await prisma.itTicket.update({
        where: { id: t.id },
        data: patch,
        include: { assignedTo: { select: { name: true } } },
      });
      await logAudit({
        actor,
        action: "IT_TICKET_UPDATED",
        entityType: "IT_TICKET",
        entityId: t.id,
        details: `${t.ticketNumber} · ${result.status}${result.resolution ? ` · ${result.resolution}` : ""}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/it-tickets error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
