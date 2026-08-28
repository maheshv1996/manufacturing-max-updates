import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        line: { include: { plant: true } },
      },
    });

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // All downstream queries are independent of each other — fire them in
    // parallel instead of a 12-query serial waterfall.
    const [
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
      myRoster,
      stationInProgress,
    ] = await Promise.all([
      prisma.downtimeLog.findFirst({
        where: { machineId, endTime: null },
        include: { reason: true },
        orderBy: { startTime: "desc" },
      }),
      prisma.workOrder.findMany({
        where: { status: "IN_PROGRESS" },
        include: {
          project: true,
          product: {
            include: {
              routingSteps: {
                include: { machine: true, operation: true },
                orderBy: { seq: "asc" },
              },
              fixtures: true,
            },
          },
          productionLogs: { select: { goodQuantity: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.workOrder.findMany({
        where: { status: "PLANNED" },
        include: {
          product: {
            include: {
              routingSteps: {
                include: { machine: true, operation: true },
                orderBy: { seq: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.shift.findMany(),
      prisma.assignment.findMany({
        where: { machineId, status: "ACTIVE" },
        include: { operator: true, shift: true },
      }),
      prisma.maintenanceTool.findMany({ where: { machineId } }),
      operatorId
        ? prisma.certification.findMany({
            where: {
              userId: operatorId,
              isActive: true,
              validFrom: { lte: new Date() },
              OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
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
            orderBy: { clockIn: "desc" },
          })
        : Promise.resolve(null),
      operatorId
        ? prisma.certification.findUnique({
            where: { userId_machineId: { userId: operatorId, machineId } },
          })
        : Promise.resolve(null),
      operatorId
        ? (async () => {
            const { startOfWeek, format } = await import("date-fns");
            const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
            const roster = await prisma.shiftRoster.findUnique({
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
            });
            return (roster?.entries || [])
              .filter((e) => e.userId === operatorId)
              .map((e) => ({
                date: new Date(e.date).toISOString(),
                day: format(new Date(e.date), "EEE dd MMM"),
                shift: e.shift,
              }))
              .sort((a, b) => a.date.localeCompare(b.date));
          })()
        : Promise.resolve([]),
      machine.stationName
        ? prisma.workOrder.findMany({
            where: { status: "IN_PROGRESS" },
            include: {
              product: {
                include: {
                  routingSteps: {
                    include: { operation: true },
                    orderBy: { seq: "asc" },
                  },
                },
              },
              movementLogs: { orderBy: { at: "desc" }, take: 1 },
            },
          })
        : Promise.resolve([]),
    ]);

    // Active WO for THIS machine: an IN_PROGRESS WO whose CURRENT routing step
    // is routed here. Routing defines position — the seed's 365 days of
    // production logs all link to one WO across every machine, so any
    // log-based matching made every terminal show the same job (and the P8
    // My Queue panel was unreachable). A machine with no WO routed to it has
    // no active job, and its planned-WO queue is what the operator sees.
    const activeWorkOrder =
      inProgressWos.find((wo) => {
        const step = wo.product.routingSteps.find(
          (s) => s.seq === (wo.currentSeq || 1),
        );
        return step?.machineId === machineId;
      }) || null;

    // P8 — Planned Work Orders available to start. Each carries its current
    // routing step machine so the terminal can build a skill-based My Queue
    // (only WOs whose op machine matches the operator's valid certifications).
    const plannedWithSkill = plannedWorkOrders.map((wo) => {
      const currentStep = wo.product.routingSteps.find(
        (s) => s.seq === (wo.currentSeq || 1),
      );
      return {
        ...wo,
        currentMachineId: currentStep?.machineId || null,
        currentMachineName: currentStep?.machine?.name || null,
        currentOpName:
          currentStep?.operation?.name || currentStep?.machine?.name || null,
      };
    });

    const skillMachineIds = certs.map((c) => c.machineId);
    const overrideWorkOrderIds = overrides.map((o) => o.workOrderId);

    // Current shift matching
    const nowStr = new Date().toTimeString().slice(0, 5); // "HH:MM"
    const currentShift =
      shifts.find((s) => nowStr >= s.startTime && nowStr <= s.endTime) ||
      shifts[0] ||
      null;

    // Incoming queue: WOs whose next routing step's stationName matches this machine's stationName
    const incomingQueue = machine.stationName
      ? stationInProgress
          .filter((wo) => {
            const nextStep = wo.product.routingSteps.find(
              (s) => s.seq === wo.currentSeq + 1,
            );
            return nextStep?.stationName === machine.stationName;
          })
          .map((wo) => {
            const currentStep = wo.product.routingSteps.find(
              (s) => s.seq === wo.currentSeq,
            );
            const nextStep = wo.product.routingSteps.find(
              (s) => s.seq === wo.currentSeq + 1,
            );
            const lastMovement = wo.movementLogs[0];
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
