import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const machineId = searchParams.get("machineId");

    const where: any = {};
    if (status) where.status = status;
    if (machineId) where.machineId = machineId;

    const jobs = await (prisma as any).maintenanceJob.findMany({
      where,
      include: {
        machine: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ status: "asc" }, { openedAt: "desc" }],
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("GET /api/maintenance/jobs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { machineId, requestedByName, type, priority, description } = body;

    if (!machineId || !requestedByName || !description) {
      return NextResponse.json(
        { error: "machineId, requestedByName and description are required" },
        { status: 400 },
      );
    }

    const job = await (prisma as any).maintenanceJob.create({
      data: {
        machineId,
        requestedByName,
        type: type || "BREAKDOWN",
        priority: priority || "MEDIUM",
        description,
        status: "OPEN",
      },
      include: {
        machine: { select: { id: true, name: true, code: true } },
      },
    });

    const headerList = await headers();
    await logAudit({
      actor: headerList.get("x-user-name") || requestedByName || "Operator",
      action: "MAINTENANCE_JOB_CREATE",
      entityType: "MAINTENANCE_JOB",
      entityId: job.id,
      details: `Created ${job.type} job [${job.priority}] for machine ${job.machine.name}: "${description}"`,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/maintenance/jobs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
