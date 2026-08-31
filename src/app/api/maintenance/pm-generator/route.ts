import { logAudit } from "@/lib/audit";
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "PM_WORK_ORDERS_GENERATED", entityType: "MaintenanceJob", details: "Preventive maintenance jobs generated" });
  try {
    const { machineId, machineCode } = await req.json();

    const created = await prisma.maintenanceJob.create({
      data: {
        machineId,
        type: "PM",
        description: `Spindle 500h Scheduled Service for ${machineCode}`,
        costRupees: 4500,
        requestedByName: "Autonomous PM Scheduler",
        priority: "MEDIUM",
        status: "OPEN",
      },
    });

    return NextResponse.json({ success: true, message: `Generated PM Service Work Order for ${machineCode}!`, job: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
