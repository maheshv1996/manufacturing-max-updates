import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const actorName = user.name || headerList.get("x-user-name") || "Admin";

    const rule = await (prisma as any).pMRule.findUnique({
      where: { id },
      include: { machine: { select: { name: true } } },
    });

    if (!rule) {
      return NextResponse.json({ error: "PM rule not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await (tx as any).pMRule.update({
        where: { id },
        data: { lastDoneAt: new Date() },
        include: { machine: { select: { id: true, name: true, code: true } } },
      });

      let job: any = null;
      if (rule.kitId) {
        job = await (tx as any).maintenanceJob.create({
          data: {
            machineId: rule.machineId,
            requestedByName: actorName,
            type: "PM",
            priority: "MEDIUM",
            description: `PM job: ${rule.title}`,
            kitId: rule.kitId,
          },
          include: { kit: { include: { items: { include: { spare: true } } } } },
        });
      }

      await logAuditTx(tx, {
        actor: actorName,
        action: "PM_DONE",
        entityType: "PM_RULE",
        entityId: id,
        details: `Marked PM done: "${rule.title}" on ${rule.machine.name}${job ? ` — PM job opened with kit "${job.kit?.name}" (${job.kit?.items?.length ?? 0} spares)` : ""}`,
      });

      return { rule: updated, job };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
