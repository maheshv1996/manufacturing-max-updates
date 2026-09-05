import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.view", "system.view"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const machines = await prisma.machine.findMany({
      include: {
        line: { include: { plant: true } },
      },
    });

    const result = await Promise.all(
      machines.map(async (m) => {
        const openDowntime = await prisma.downtimeLog.findFirst({
          where: { machineId: m.id, endTime: null },
          include: { reason: true },
          orderBy: { startTime: "desc" },
        });

        const inProgressLog = await prisma.productionLog.findFirst({
          where: { machineId: m.id, workOrder: { status: "IN_PROGRESS" } },
          include: { workOrder: { include: { product: true } } },
          orderBy: { startTime: "desc" },
        });

        let status: "DOWN" | "RUNNING" | "IDLE" | "SETUP" = "IDLE";

        if (m.iotEnabled) {
          if (m.currentState === "FAULT") status = "DOWN";
          else if (m.currentState === "RUNNING") status = "RUNNING";
          else if (m.currentState === "SETUP") status = "SETUP";
          else status = "IDLE";
        } else {
          if (openDowntime) {
            status = "DOWN";
          } else if (inProgressLog) {
            status = "RUNNING";
          } else if (m.status === "SETUP") {
            status = "SETUP";
          }
        }

        let downtimeMinutes = 0;
        if (openDowntime) {
          downtimeMinutes = Math.floor(
            (new Date().getTime() -
              new Date(openDowntime.startTime).getTime()) /
              60000,
          );
        }

        let goodQuantity = 0;
        let plannedQuantity = 0;

        if (inProgressLog && inProgressLog.workOrder) {
          plannedQuantity = inProgressLog.workOrder.plannedQuantity;
          const logs = await prisma.productionLog.findMany({
            where: { workOrderId: inProgressLog.workOrder.id },
          });
          goodQuantity = logs.reduce((acc, curr) => acc + curr.goodQuantity, 0);
        }

        // Check Tool alerts assigned to machine
        const assignedTools = await (prisma as any).tool.findMany({
          where: {
            assignedMachineId: m.id,
            status: { in: ["WARNING", "MAINTENANCE"] },
          },
        });

        let toolAlert = null;
        if (assignedTools.length > 0) {
          const maintTool = assignedTools.find(
            (t: any) => t.status === "MAINTENANCE",
          );
          const warnTool = assignedTools.find(
            (t: any) => t.status === "WARNING",
          );

          if (maintTool) {
            toolAlert = {
              type: "MAINTENANCE",
              name: maintTool.name,
              code: maintTool.toolCode,
              currentCycles: maintTool.currentCycles,
              maxLifeCycles: maintTool.maxLifeCycles,
            };
          } else if (warnTool) {
            toolAlert = {
              type: "WARNING",
              name: warnTool.name,
              code: warnTool.toolCode,
              currentCycles: warnTool.currentCycles,
              maxLifeCycles: warnTool.maxLifeCycles,
            };
          }
        }

        const activeSafetyAlert = await (
          prisma as any
        ).safetyIncident.findFirst({
          where: {
            status: { in: ["OPEN", "CAPA_ASSIGNED"] },
            severity: { in: ["HIGH", "CRITICAL"] },
            location: { contains: m.name, mode: "insensitive" },
          },
          orderBy: { createdAt: "desc" },
        });

        return {
          id: m.id,
          name: m.name,
          code: m.code,
          plantName: m.line?.plant?.name || "Unknown Plant",
          status,
          iotEnabled: m.iotEnabled,
          currentState: m.currentState,
          downtimeReason: openDowntime?.reason?.description || null,
          downtimeMinutes,
          workOrderNumber: inProgressLog?.workOrder?.woNumber || null,
          productName: inProgressLog?.workOrder?.product?.name || null,
          goodQuantity,
          plannedQuantity,
          toolAlert,
          safetyAlert: activeSafetyAlert
            ? {
                id: activeSafetyAlert.id,
                type: activeSafetyAlert.type,
                severity: activeSafetyAlert.severity,
                description: activeSafetyAlert.description,
              }
            : null,
        };
      }),
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("Andon API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Andon data" },
      { status: 500 },
    );
  }
}
