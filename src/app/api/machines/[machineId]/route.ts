import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ machineId: string }> },
) {
  try {
    const { machineId } = await params;

    const machine = await prisma.machine.findUnique({
      where: {
        id: machineId,
      },
      include: {
        line: {
          include: {
            plant: true,
          },
        },
        productionLogs: {
          include: {
            workOrder: {
              include: {
                product: true,
              },
            },
            operator: true,
            shift: true,
          },
          orderBy: {
            startTime: "desc",
          },
        },
        downtimeLogs: {
          include: {
            reason: true,
            workOrder: {
              include: {
                product: true,
              },
            },
          },
          orderBy: {
            startTime: "desc",
          },
        },
      },
    });

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    const activeLog = machine.productionLogs.find(
      (log) => log.workOrder && log.workOrder.status === "IN_PROGRESS",
    );
    const activeWorkOrder = activeLog ? activeLog.workOrder : null;

    return NextResponse.json({ ...machine, activeWorkOrder });
  } catch (error) {
    console.error("Error fetching machine detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch machine detail" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ machineId: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["ops.edit", "maintenance.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { machineId } = await params;
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const actor = user.name || user.id || "Operator";

    const machine = await prisma.$transaction(async (tx) => {
      const updated = await tx.machine.update({
        where: { id: machineId },
        data: {
          oeeTarget: body.oeeTarget,
          oeeGoodThreshold: body.oeeGoodThreshold,
          oeeWarningThreshold: body.oeeWarningThreshold,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "MACHINE_OEE_SETTINGS_UPDATED",
        entityType: "Machine",
        entityId: machineId,
        details: `oeeTarget=${body.oeeTarget} · goodThreshold=${body.oeeGoodThreshold} · warningThreshold=${body.oeeWarningThreshold}`,
      });

      return updated;
    });

    return NextResponse.json(machine);
  } catch (error) {
    console.error("Error updating machine:", error);
    return NextResponse.json(
      { error: "Failed to update machine" },
      { status: 500 },
    );
  }
}
