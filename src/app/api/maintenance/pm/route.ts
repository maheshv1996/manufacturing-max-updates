import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function computeNextDue(rule: any): Date | null {
  if (!rule.lastDoneAt || !rule.intervalDays) return null;
  const d = new Date(rule.lastDoneAt);
  d.setDate(d.getDate() + rule.intervalDays);
  return d;
}

export async function GET() {
  try {
    const rules = await (prisma as any).pMRule.findMany({
      where: { isActive: true },
      include: {
        machine: { select: { id: true, name: true, code: true } },
      },
      orderBy: { machineId: "asc" },
    });

    const now = new Date();
    const enriched = rules.map((r: any) => {
      const nextDue = computeNextDue(r);
      const isOverdue = nextDue ? nextDue < now : !r.lastDoneAt;
      const daysDiff = nextDue
        ? Math.round(
            (nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;
      return { ...r, nextDue, isOverdue, daysDiff };
    });

    return NextResponse.json({ rules: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { machineId, title, intervalDays, intervalRunHours } = body;

    if (!machineId || !title) {
      return NextResponse.json(
        { error: "machineId and title are required" },
        { status: 400 },
      );
    }

    const actor = user.name || headerList.get("x-user-name") || "Admin";

    const rule = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).pMRule.create({
        data: {
          machineId,
          title,
          intervalDays: intervalDays ? Number(intervalDays) : null,
          intervalRunHours: intervalRunHours ? Number(intervalRunHours) : null,
        },
        include: { machine: { select: { id: true, name: true, code: true } } },
      });

      await logAuditTx(tx, {
        actor,
        action: "PM_RULE_CREATE",
        entityType: "PM_RULE",
        entityId: created.id,
        details: `Created PM rule "${title}" for machine ${created.machine.name}`,
      });

      return created;
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
