import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const rule = await (prisma as any).pMRule.findUnique({
      where: { id },
      include: { machine: { select: { name: true } } },
    });

    if (!rule) {
      return NextResponse.json({ error: "PM rule not found" }, { status: 404 });
    }

    const updated = await (prisma as any).pMRule.update({
      where: { id },
      data: { lastDoneAt: new Date() },
      include: { machine: { select: { id: true, name: true, code: true } } },
    });

    const headerList = await headers();
    const actorName = headerList.get("x-user-name") || "Admin";

    // M27 — kit lists auto-attach to PM jobs: completing a PM opens the PM
    // maintenance job and carries the rule's spare kit (planned spares).
    let job: any = null;
    if (rule.kitId) {
      job = await (prisma as any).maintenanceJob.create({
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

    await logAudit({
      actor: actorName,
      action: "PM_DONE",
      entityType: "PM_RULE",
      entityId: id,
      details: `Marked PM done: "${rule.title}" on ${rule.machine.name}${job ? ` — PM job opened with kit "${job.kit?.name}" (${job.kit?.items?.length ?? 0} spares)` : ""}`,
    });

    return NextResponse.json({ rule: updated, job });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
