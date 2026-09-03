import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

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

    const [grievances, settings] = await Promise.all([
      prisma.grievance.findMany({
        include: {
          user: { select: { id: true, name: true, employeeNumber: true } },
        },
        orderBy: { raisedAt: "desc" },
        take: 300,
      }),
      prisma.setting.findMany({
        where: { key: { in: ["grievanceAckDays", "grievanceResolveDays"] } },
      }),
    ]);
    const ackDays = parseInt(
      settings.find((s) => s.key === "grievanceAckDays")?.value || "2",
      10,
    );
    const resolveDays = parseInt(
      settings.find((s) => s.key === "grievanceResolveDays")?.value || "14",
      10,
    );
    const now = Date.now();
    const enriched = grievances.map((g) => {
      const ackDue = g.raisedAt.getTime() + ackDays * 86400000;
      const resolveDue =
        Math.max(g.raisedAt.getTime(), g.acknowledgedAt?.getTime() || 0) +
        resolveDays * 86400000;
      const ackOverdue = g.stage === "RAISED" && now > ackDue;
      const resolveOverdue =
        (g.stage === "ACKNOWLEDGED" || g.stage === "INVESTIGATING") &&
        now > resolveDue;
      return {
        ...g,
        ackDue: new Date(ackDue),
        resolveDue: new Date(resolveDue),
        ackOverdue,
        resolveOverdue,
        timeline: {
          raised: g.raisedAt,
          acknowledged: g.acknowledgedAt,
          investigated: g.investigatedAt,
          resolved: g.resolvedAt,
        },
      };
    });
    const stats = {
      total: grievances.length,
      raised: grievances.filter((g) => g.stage === "RAISED").length,
      acknowledged: grievances.filter((g) => g.stage === "ACKNOWLEDGED").length,
      investigating: grievances.filter((g) => g.stage === "INVESTIGATING")
        .length,
      resolved: grievances.filter((g) => g.stage === "RESOLVED").length,
      overdue: enriched.filter((g) => g.ackOverdue || g.resolveOverdue).length,
    };
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, employeeNumber: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ grievances: enriched, stats, users });
  } catch (error) {
    console.error("GET /api/grievances error:", error);
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
    if (action !== "raise")
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const gate =
      canAny(user, ["people.view", "people.edit", "system.edit"]) ||
      user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { category, description, userId } = data;
    if (!category || !description)
      return NextResponse.json(
        { error: "category and description required" },
        { status: 400 },
      );
    const targetId = userId || user.id;
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (userId && userId !== user.id) {
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json({ error: mgr.error }, { status: 403 });
    }
    const number = await nextSeqNumber("grievance", "grievanceNumber", "GRV");
    const record = await prisma.grievance.create({
      data: {
        grievanceNumber: number,
        userId: targetId,
        category,
        description: description.trim(),
      },
    });
    await logAudit({
      actor,
      action: "GRIEVANCE_RAISED",
      entityType: "GRIEVANCE",
      entityId: record.id,
      details: `${number} · ${category} · ${target.name}`,
    });
    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("POST /api/grievances error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
