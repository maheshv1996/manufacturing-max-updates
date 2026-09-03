import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "downtime";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const machineId = searchParams.get("machineId");

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
    const endDate = endDateParam ? new Date(endDateParam) : now;
    endDate.setHours(23, 59, 59, 999);

    if (type === "downtime") {
      const downtimeLogs = await prisma.downtimeLog.findMany({
        where: {
          startTime: { gte: startDate, lte: endDate },
          ...(machineId ? { machineId } : {}),
        },
        include: { machine: true, reason: true },
        orderBy: { startTime: "desc" },
      });

      const machines = await prisma.machine.findMany({
        include: { line: true },
      });

      return NextResponse.json({ downtimeLogs, machines });
    }

    if (type === "performance") {
      const machines = await prisma.machine.findMany({
        include: { line: true },
      });

      const productionLogs = await prisma.productionLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
      });

      const downtimeLogs = await prisma.downtimeLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
      });

      return NextResponse.json({ machines, productionLogs, downtimeLogs });
    }

    if (type === "pareto") {
      const downtimeLogs = await prisma.downtimeLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
        include: { reason: true, machine: true },
      });

      return NextResponse.json({ downtimeLogs });
    }

    if (type === "operator-efficiency") {
      const users = await prisma.user.findMany({
        where: { role: { name: "Operator" } },
      });

      const productionLogs = await prisma.productionLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
        include: { workOrder: { include: { product: true } }, machine: true },
      });

      return NextResponse.json({ users, productionLogs });
    }

    if (type === "attendance") {
      const attendanceLogs = await prisma.attendanceLog.findMany({
        where: { clockIn: { gte: startDate, lte: endDate } },
        include: { user: true, shift: true },
        orderBy: { clockIn: "desc" },
      });

      const assignments = await prisma.assignment.findMany({
        where: { status: "ACTIVE" },
        include: { operator: true, machine: true, shift: true },
      });

      const shifts = await prisma.shift.findMany();

      return NextResponse.json({ attendanceLogs, assignments, shifts });
    }

    if (type === "fives") {
      const audits = await prisma.fiveSAudit.findMany({
        include: { scores: { include: { item: true } } },
        orderBy: { date: "desc" },
      });

      const items = await prisma.fiveSItem.findMany({
        orderBy: [{ category: "asc" }, { seq: "asc" }],
      });

      return NextResponse.json({ audits, items });
    }

    if (type === "traveler") {
      const workOrders = await prisma.workOrder.findMany({
        include: {
          product: {
            include: {
              routingSteps: {
                include: { operation: true },
                orderBy: { seq: "asc" },
              },
            },
          },
          movementLogs: { orderBy: { at: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ workOrders });
    }

    if (type === "shift") {
      const shifts = await prisma.shift.findMany();
      const handovers = await prisma.shiftHandover.findMany({
        include: { shift: true },
        orderBy: { createdAt: "desc" },
      });

      const productionLogs = await prisma.productionLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
        include: {
          machine: true,
          operator: true,
          workOrder: { include: { product: true } },
        },
      });

      const downtimeLogs = await prisma.downtimeLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
        include: { machine: true, reason: true },
      });

      return NextResponse.json({
        shifts,
        handovers,
        productionLogs,
        downtimeLogs,
      });
    }

    if (type === "leaderboard") {
      const operators = await prisma.user.findMany({
        where: { role: { name: "Operator" } },
      });

      const logs = await prisma.productionLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
        include: { workOrder: { include: { product: true } } },
      });

      return NextResponse.json({ operators, logs });
    }

    if (type === "machine-history") {
      const machines = await prisma.machine.findMany({
        include: { line: true },
      });

      const downtimeLogs = await prisma.downtimeLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
        include: { reason: true },
        orderBy: { startTime: "desc" },
      });

      const productionLogs = await prisma.productionLog.findMany({
        where: { startTime: { gte: startDate, lte: endDate } },
        orderBy: { startTime: "desc" },
      });

      return NextResponse.json({ machines, downtimeLogs, productionLogs });
    }

    if (type === "morning-pack") {
      const [
        machines,
        workOrders,
        downtimeLogs,
        attendanceLogs,
        fiveSAudits,
        productionLogs,
        topIdeas,
      ] = await Promise.all([
        prisma.machine.findMany({ include: { line: true } }),
        prisma.workOrder.findMany({
          where: { status: { in: ["IN_PROGRESS", "PLANNED", "COMPLETED"] } },
          include: { product: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.downtimeLog.findMany({
          where: { startTime: { gte: startDate } },
          include: { reason: true, machine: true },
        }),
        prisma.attendanceLog.findMany({
          where: { clockIn: { gte: startDate } },
          include: { user: true, shift: true },
        }),
        prisma.fiveSAudit.findMany({
          orderBy: { date: "desc" },
          take: 5,
        }),
        prisma.productionLog.findMany({
          where: { startTime: { gte: startDate } },
        }),
        (prisma as any).idea.findMany({
          where: { status: { in: ["APPROVED", "IMPLEMENTED"] } },
          orderBy: [{ upvotes: "desc" }, { createdAt: "desc" }],
          take: 5,
        }),
      ]);

      return NextResponse.json({
        machines,
        workOrders,
        downtimeLogs,
        attendanceLogs,
        fiveSAudits,
        productionLogs,
        topIdeas,
      });
    }

    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  } catch (error: any) {
    console.error("Fetch print data error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
