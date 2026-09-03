import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [machines, downtimeLogs, maintenanceJobs, pmRules] =
      await Promise.all([
        prisma.machine.findMany({
          where: { isActive: true },
          include: {
            line: true,
            downtimeLogs: {
              include: {
                reason: true,
              },
            },
            maintenanceJobs: {
              orderBy: { openedAt: "desc" },
            },
            pmRules: true,
          },
          orderBy: { code: "asc" },
        }),
        prisma.downtimeLog.findMany({
          orderBy: { startTime: "desc" },
        }),
        prisma.maintenanceJob.findMany({
          include: {
            machine: true,
          },
          orderBy: { openedAt: "desc" },
        }),
        prisma.pMRule.findMany({
          include: {
            machine: true,
          },
        }),
      ]);

    // Calculate MTBF, MTTR, and Reliability per machine
    const machineReliability = machines.map((m) => {
      const breakdownLogs = m.downtimeLogs.filter(
        (dt) =>
          dt.reason?.category === "MECHANICAL" ||
          dt.reason?.category === "ELECTRICAL" ||
          (dt.reason?.description || "").toLowerCase().includes("breakdown") ||
          (dt.notes || "").toLowerCase().includes("fault") ||
          (dt.notes || "").toLowerCase().includes("breakdown"),
      );
      const totalBreakdowns = Math.max(1, breakdownLogs.length);
      const totalDowntimeMinutes = m.downtimeLogs.reduce(
        (sum, dt) => sum + (dt.durationMinutes || 30),
        0,
      );

      // Estimated 720 hours of operation in standard month (24d * 3 shifts = 576-720h)
      const totalPlannedHours = 720;
      const totalDowntimeHours = totalDowntimeMinutes / 60;
      const operatingHours = Math.max(
        10,
        totalPlannedHours - totalDowntimeHours,
      );

      // MTBF = Operating Hours / Breakdown Count
      const mtbfHours =
        Math.round((operatingHours / totalBreakdowns) * 10) / 10;

      // MTTR = Total Downtime Minutes / Breakdown Count
      const mttrMinutes = Math.round(totalDowntimeMinutes / totalBreakdowns);

      // Availability (A) %
      const availabilityPct =
        Math.round((operatingHours / totalPlannedHours) * 100 * 10) / 10;

      // Overall Machine Health Score (0 - 100)
      const healthScore = Math.min(
        100,
        Math.max(
          20,
          Math.round(
            availabilityPct * 0.7 +
              (mtbfHours > 100 ? 30 : (mtbfHours / 100) * 30),
          ),
        ),
      );

      return {
        id: m.id,
        code: m.code,
        name: m.name,
        lineName: m.line?.name || "Main Production Line",
        status: m.status,
        currentState: m.currentState,
        iotEnabled: m.iotEnabled,
        totalBreakdowns: breakdownLogs.length,
        totalDowntimeMinutes,
        mtbfHours,
        mttrMinutes,
        availabilityPct,
        healthScore,
        openJobsCount: m.maintenanceJobs.filter((j) => j.status !== "CLOSED")
          .length,
        pmRulesCount: m.pmRules.length,
      };
    });

    // Factory Overview Summary
    const avgMtbf = Math.round(
      machineReliability.reduce((sum, m) => sum + m.mtbfHours, 0) /
        Math.max(1, machineReliability.length),
    );
    const avgMttr = Math.round(
      machineReliability.reduce((sum, m) => sum + m.mttrMinutes, 0) /
        Math.max(1, machineReliability.length),
    );
    const avgAvailability =
      Math.round(
        (machineReliability.reduce((sum, m) => sum + m.availabilityPct, 0) /
          Math.max(1, machineReliability.length)) *
          10,
      ) / 10;
    const activeBreakdownJobs = maintenanceJobs.filter(
      (j) => j.status === "OPEN" || (j.status as any) === "IN_PROGRESS",
    ).length;

    return NextResponse.json({
      machines: machineReliability,
      downtimeLogsCount: downtimeLogs.length,
      maintenanceJobs,
      pmRules,
      summary: {
        avgMtbfHours: avgMtbf,
        avgMttrMinutes: avgMttr,
        plantAvailabilityPct: avgAvailability,
        activeBreakdownJobs,
        totalMachines: machines.length,
      },
    });
  } catch (error: any) {
    console.error("Failed to load maintenance reliability data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { machineId, type, priority, description, requestedByName } = body;

    if (!machineId || !description) {
      return NextResponse.json(
        { error: "Machine and Description are required" },
        { status: 400 },
      );
    }

    const job = await prisma.maintenanceJob.create({
      data: {
        machineId,
        type: type || "BREAKDOWN",
        priority: priority || "HIGH",
        description,
        requestedByName: requestedByName || "Shopfloor Operator",
        status: "OPEN",
      },
      include: {
        machine: true,
      },
    });

    // If breakdown, set machine status to DOWN
    if (type === "BREAKDOWN") {
      await prisma.machine.update({
        where: { id: machineId },
        data: { status: "DOWN" },
      });
    }

    await logAudit({
      actor: requestedByName || "operator",
      action: "MAINTENANCE_JOB_LOGGED",
      entityType: "MaintenanceJob",
      entityId: job.id,
      details: `Logged ${type || "BREAKDOWN"} maintenance for ${job.machine.code}: ${description}`,
    });

    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    console.error("Failed to create maintenance job:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { jobId, status, rootCause, countermeasure, closedBy } = body;

    if (!jobId || !status) {
      return NextResponse.json(
        { error: "Job ID and Status are required" },
        { status: 400 },
      );
    }

    const job = await prisma.maintenanceJob.update({
      where: { id: jobId },
      data: {
        status,
        rootCause: rootCause || undefined,
        countermeasure: countermeasure || undefined,
        closedAt: status === "CLOSED" ? new Date() : undefined,
        closedBy:
          status === "CLOSED" ? closedBy || "Maintenance Engineer" : undefined,
      },
      include: {
        machine: true,
      },
    });

    // If job closed, restore machine status to RUNNING
    if (status === "CLOSED") {
      await prisma.machine.update({
        where: { id: job.machineId },
        data: { status: "RUNNING" },
      });
    }

    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    console.error("Failed to update maintenance job:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
