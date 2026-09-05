import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      include: {
        maintenanceJobs: {
          take: 3,
          orderBy: { openedAt: "desc" },
        },
      },
    });

    const schedules = machines.map((m) => {
      const runningHours = 340;
      const nextPmHours = 500;
      const hoursRemaining = Math.max(0, nextPmHours - runningHours);

      return {
        machineId: m.id,
        code: m.code,
        name: m.name,
        runningHours,
        nextPmHours,
        hoursRemaining,
        tasks: [
          "Spindle taper runout check (Max 0.003 mm)",
          "Hydraulic filter & lube oil top-up (ISO VG 68)",
          "X/Y/Z linear guideway wiper inspection",
          "Coolant tank sludge removal & refractometer calibration",
        ],
        dueStatus: hoursRemaining <= 50 ? "DUE_SOON" : "HEALTHY",
      };
    });

    return NextResponse.json({ success: true, schedules });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { machineId, machineCode } = body;
    if (!machineId) {
      return NextResponse.json({ error: "machineId is required" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const job = await tx.maintenanceJob.create({
        data: {
          machineId,
          type: "PM",
          description: `Spindle 500h Scheduled Service for ${machineCode || machineId}`,
          costRupees: 4500,
          requestedByName: "Autonomous PM Scheduler",
          priority: "MEDIUM",
          status: "OPEN",
        },
      });

      await logAuditTx(tx, {
        actor: "system",
        action: "PM_WORK_ORDERS_GENERATED",
        entityType: "MaintenanceJob",
        entityId: job.id,
        details: `Generated PM Service Work Order for ${machineCode || machineId}`,
      });

      return job;
    });

    return NextResponse.json({ success: true, message: `Generated PM Service Work Order for ${machineCode || machineId}!`, job: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
