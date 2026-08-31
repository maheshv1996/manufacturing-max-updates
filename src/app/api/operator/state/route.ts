import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, format } from "date-fns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId");
    const operatorId = searchParams.get("operatorId");

    if (!machineId) {
      return NextResponse.json(
        { error: "Machine ID is required" },
        { status: 400 },
      );
    }

    const now = new Date();
    const ws = startOfWeek(now, { weekStartsOn: 1 });

    // Single parallel batch with strict select projection narrowing
    const [
      machine,
      latestTelemetry,
      openDowntime,
      inProgressWos,
      plannedWorkOrders,
      shifts,
      activeAssignments,
      assignedTools,
      certs,
      overrides,
      todayAttendanceLog,
      certification,
      roster,
    ] = await Promise.all([
      prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          line: { include: { plant: true } },
        },
      }),
      prisma.telemetryLog.findFirst({
        where: { machineId },
        orderBy: { at: "desc" },
        select: { id: true, state: true, cycleCount: true, at: true },
      }),
      prisma.downtimeLog.findFirst({
        where: { machineId, endTime: null },
        select: {
          id: true,
          machineId: true,
          startTime: true,
          endTime: true,
          reasonId: true,
          notes: true,
          status: true,
          reason: { select: { id: true, code: true, description: true, category: true } },
        },
        orderBy: { startTime: "desc" },
      }),
      prisma.workOrder.findMany({
        where: { status: "IN_PROGRESS" },
        select: {
          id: true,
          woNumber: true,
          currentSeq: true,
          plannedQuantity: true,
          status: true,
          trackingMode: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              routingSteps: {
                select: {
                  id: true,
                  seq: true,
                  stationName: true,
                  machineId: true,
                  operation: { select: { id: true, name: true, code: true } },
                  machine: { select: { id: true, name: true, code: true } },
                },
                orderBy: { seq: "asc" },
              },
              fixtures: { select: { id: true, code: true, name: true, location: true } },
            },
          },
          productionLogs: { select: { goodQuantity: true } },
          movementLogs: {
            select: { quantity: true, at: true },
            orderBy: { at: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.workOrder.findMany({
        where: { status: "PLANNED" },
        take: 25,
        select: {
          id: true,
          woNumber: true,
          currentSeq: true,
          plannedQuantity: true,
          status: true,
          trackingMode: true,
          plannedStartDate: true,
          plannedEndDate: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              routingSteps: {
                select: {
                  id: true,
                  seq: true,
                  stationName: true,
                  machineId: true,
                  operation: { select: { id: true, name: true, code: true } },
                  machine: { select: { id: true, name: true, code: true } },
                },
                orderBy: { seq: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.shift.findMany({
        select: { id: true, name: true, startTime: true, endTime: true },
      }),
      prisma.assignment.findMany({
        where: { machineId, status: "ACTIVE" },
        select: {
          id: true,
          machineId: true,
          status: true,
          shiftId: true,
          operator: { select: { id: true, name: true, employeeNumber: true, username: true } },
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        },
      }),
      prisma.maintenanceTool.findMany({
        where: { machineId },
        select: { id: true, code: true, name: true, machineId: true, lifeStatus: true, ratedLifeUnits: true, usedUnits: true },
      }),
      operatorId
        ? prisma.certification.findMany({
            where: {
              userId: operatorId,
              isActive: true,
              validFrom: { lte: now },
              OR: [{ validUntil: null }, { validUntil: { gte: now } }],
            },
            select: { machineId: true },
          })
        : Promise.resolve([]),
      operatorId
        ? prisma.assignmentOverride.findMany({
            where: { operatorId },
            select: { workOrderId: true },
          })
        : Promise.resolve([]),
      operatorId
        ? prisma.attendanceLog.findFirst({
            where: { userId: operatorId, clockOut: null },
            select: { id: true, userId: true, clockIn: true, status: true, shiftId: true },
            orderBy: { clockIn: "desc" },
          })
        : Promise.resolve(null),
      operatorId
        ? prisma.certification.findUnique({
            where: { userId_machineId: { userId: operatorId, machineId } },
            select: { id: true, userId: true, machineId: true, isActive: true, validUntil: true },
          })
        : Promise.resolve(null),
      operatorId
        ? prisma.shiftRoster.findUnique({
            where: { weekStart: ws },
            include: {
              entries: {
                include: {
                  shift: {
                    select: {
                      id: true,
                      name: true,
                      startTime: true,
                      endTime: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // Active WO for THIS machine: an IN_PROGRESS WO whose CURRENT routing step is routed here
    const activeWorkOrder =
      inProgressWos.find((wo: any) => {
        const step = wo.product.routingSteps.find(
          (s: any) => s.seq === (wo.currentSeq || 1),
        );
        return step?.machineId === machineId;
      }) || null;

    // Planned Work Orders available to start
    const plannedWithSkill = plannedWorkOrders.map((wo: any) => {
      const currentStep = wo.product.routingSteps.find(
        (s: any) => s.seq === (wo.currentSeq || 1),
      );
      return {
        ...wo,
        currentMachineId: currentStep?.machineId || null,
        currentMachineName: currentStep?.machine?.name || null,
        currentOpName:
          currentStep?.operation?.name || currentStep?.machine?.name || null,
      };
    });

    const skillMachineIds = certs.map((c: any) => c.machineId);
    const overrideWorkOrderIds = overrides.map((o: any) => o.workOrderId);

    // Current shift matching
    const nowStr = now.toTimeString().slice(0, 5); // "HH:MM"
    const currentShift =
      shifts.find((s) => nowStr >= s.startTime && nowStr <= s.endTime) ||
      shifts[0] ||
      null;

    // Process Roster
    const myRoster = (roster?.entries || [])
      .filter((e) => e.userId === operatorId)
      .map((e) => ({
        date: new Date(e.date).toISOString(),
        day: format(new Date(e.date), "EEE dd MMM"),
        shift: e.shift,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Incoming queue: WOs whose next routing step's stationName matches this machine's stationName
    const incomingQueue = machine.stationName
      ? inProgressWos
          .filter((wo: any) => {
            const nextStep = wo.product.routingSteps.find(
              (s: any) => s.seq === wo.currentSeq + 1,
            );
            return nextStep?.stationName === machine.stationName;
          })
          .map((wo: any) => {
            const currentStep = wo.product.routingSteps.find(
              (s: any) => s.seq === wo.currentSeq,
            );
            const nextStep = wo.product.routingSteps.find(
              (s: any) => s.seq === wo.currentSeq + 1,
            );
            const lastMovement = wo.movementLogs?.[0];
            return {
              id: wo.id,
              woNumber: wo.woNumber,
              productName: wo.product.name,
              fromStation: currentStep?.stationName || "—",
              toStation: nextStep?.stationName || "—",
              quantity: lastMovement?.quantity || wo.plannedQuantity,
            };
          })
      : [];

    return NextResponse.json({
      machine,
      latestTelemetry,
      openDowntime,
      activeWorkOrder,
      plannedWorkOrders: plannedWithSkill,
      currentShift,
      incomingQueue,
      activeAssignments,
      todayAttendanceLog,
      assignedTools,
      certification,
      skillMachineIds,
      overrideWorkOrderIds,
      myRoster,
    });
  } catch (error) {
    console.error("Error fetching operator state:", error);
    return NextResponse.json(
      { error: "Failed to fetch operator state" },
      { status: 500 },
    );
  }
}
