import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit, logAuditTx } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** P6 — snapshot of what was open on the floor when the handover was written. */
async function buildContextSnapshot() {
  const [breakdowns, openNcrs, downtime] = await Promise.all([
    (prisma as any).maintenanceJob.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, type: "BREAKDOWN" },
      orderBy: { openedAt: "desc" },
      take: 10,
    }),
    prisma.ncrReport.findMany({
      where: { status: "OPEN" },
      orderBy: { raisedAt: "desc" },
      take: 10,
    }),
    prisma.downtimeLog.findMany({
      where: { endTime: null },
      orderBy: { startTime: "desc" },
      take: 5,
    }),
  ]);
  return {
    openBreakdowns: breakdowns.map((b: any) => ({
      id: b.id,
      title: b.title || b.description,
      machine: b.machineName || b.machineId,
      priority: b.priority,
    })),
    openNcrs: openNcrs.map((n) => ({
      id: n.id,
      ncrNumber: n.ncrNumber,
      severity: n.severity,
      description: n.description,
    })),
    openDowntime: downtime.map((d) => ({
      id: d.id,
      machineId: d.machineId,
      since: d.startTime,
    })),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shiftId = searchParams.get("shiftId");
    const machineId = searchParams.get("machineId");

    const whereClause: any = {};
    if (shiftId) whereClause.shiftId = shiftId;

    if (machineId) {
      if (machineId === "PLANT") {
        whereClause.machineId = null;
      } else {
        whereClause.machineId = machineId;
      }
    }

    const handovers = await prisma.shiftHandover.findMany({
      where: whereClause,
      include: { shift: true, machine: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(handovers);
  } catch (error: any) {
    console.error("Error fetching shift handovers:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift handovers" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    // P6 — ack action: incoming supervisor acknowledges the handover.
    if (data.action === "ack") {
      if (!user.id)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const handover = await prisma.shiftHandover.findUnique({
        where: { id: data.id },
      });
      if (!handover)
        return NextResponse.json(
          { error: "Handover not found" },
          { status: 404 },
        );
      if (handover.acknowledgedAt) {
        await logAudit({
          actor: user.name || "Supervisor",
          action: "HANDOVER_ACK_DEDUPED",
          entityType: "SHIFT_HANDOVER",
          entityId: handover.id,
          details: "Handover was already acknowledged; idempotent skip",
        });
        return NextResponse.json({
          success: true,
          record: handover,
          deduped: true,
        });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.shiftHandover.update({
          where: { id: data.id },
          data: {
            acknowledgedBy: user.name || "Supervisor",
            acknowledgedAt: new Date(),
          },
          include: { shift: true, machine: true },
        });
        await logAuditTx(tx, {
          actor: user.name || "Supervisor",
          action: "HANDOVER_ACK",
          entityType: "SHIFT_HANDOVER",
          entityId: res.id,
          details: `${reason.reason}`,
        });
        return res;
      });
      return NextResponse.json(updated);
    }

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const {
      date,
      shiftId,
      authorName,
      machineId,
      productionNotes,
      downtimeNotes,
      safetyNotes,
      nextShiftActions,
      missReason,
      targetMissed,
    } = data;

    if (!date || !shiftId || !authorName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (targetMissed && (!missReason || !missReason.trim())) {
      return NextResponse.json(
        {
          error:
            "Target was missed (< 95% of plan). A 'Why did we miss plan?' reason is mandatory.",
        },
        { status: 400 },
      );
    }

    // P6 — auto-attach open breakdowns + NCRs so the incoming supervisor sees them instantly.
    const context = await buildContextSnapshot();

    const actor = user.name || authorName || "Supervisor";
    const newHandover = await prisma.$transaction(async (tx) => {
      const created = await tx.shiftHandover.create({
        data: {
          date: new Date(date),
          shiftId,
          authorName: actor,
          machineId: machineId === "PLANT" ? null : machineId,
          productionNotes: productionNotes || "",
          downtimeNotes: downtimeNotes || "",
          safetyNotes: safetyNotes || "",
          nextShiftActions: nextShiftActions || "",
          missReason: missReason ? missReason.trim() : null,
          openBreakdowns: context.openBreakdowns,
          openNcrs: context.openNcrs,
        },
        include: { shift: true, machine: true },
      });

      await logAuditTx(tx, {
        actor,
        action: "HANDOVER_CREATED",
        entityType: "SHIFT_HANDOVER",
        entityId: created.id,
        details: `${date} · shift=${shiftId} · machine=${machineId ?? "PLANT"} · missed=${targetMissed ? "yes" : "no"}`,
      });

      return created;
    });

    return NextResponse.json(newHandover);
  } catch (error: any) {
    console.error("Error creating shift handover:", error);
    return NextResponse.json(
      { error: "Failed to create shift handover" },
      { status: 500 },
    );
  }
}
