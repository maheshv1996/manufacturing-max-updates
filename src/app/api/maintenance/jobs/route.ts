import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit", "quality.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { machineId, requestedByName, type, priority, description } = body;

    if (!machineId || !requestedByName || !description) {
      return NextResponse.json(
        { error: "machineId, requestedByName and description are required" },
        { status: 400 },
      );
    }

    const actor = user.name || headersList.get("x-user-name") || requestedByName || "Operator";

    const job = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).maintenanceJob.create({
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

      await logAuditTx(tx, {
        actor,
        action: "MAINTENANCE_JOB_CREATE",
        entityType: "MAINTENANCE_JOB",
        entityId: created.id,
        details: `Created ${created.type} job [${created.priority}] for machine ${created.machine.name}: "${description}"`,
      });

      return created;
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/maintenance/jobs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
