import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

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
    const { machineId } = await params;
    const body = await request.json();

    const machine = await prisma.machine.update({
      where: { id: machineId },
      data: {
        oeeTarget: body.oeeTarget,
        oeeGoodThreshold: body.oeeGoodThreshold,
        oeeWarningThreshold: body.oeeWarningThreshold,
      },
    });

    await logAudit({
      actor: "system",
      action: "MACHINE_OEE_SETTINGS_UPDATED",
      entityType: "Machine",
      entityId: machineId,
      details: `oeeTarget=${body.oeeTarget} · goodThreshold=${body.oeeGoodThreshold} · warningThreshold=${body.oeeWarningThreshold}`,
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
