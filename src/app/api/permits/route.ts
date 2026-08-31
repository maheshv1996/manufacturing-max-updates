import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PERMIT_TYPES = [
  "HOT_WORK",
  "HEIGHT_WORK",
  "CONFINED_SPACE",
  "ELECTRICAL",
  "EXCAVATION",
];

// Auto-void permits whose validity window has lapsed.
export async function autoExpirePermits() {
  const now = new Date();
  const expired = await (prisma as any).permitToWork.updateMany({
    where: { status: "APPROVED", validUntil: { lt: now } },
    data: { status: "EXPIRED", voidedAt: now, voidedBy: "SYSTEM_AUTO" },
  });
  if (expired.count > 0) {
      }
  return expired.count;
}

export async function GET() {
  try {
    await autoExpirePermits();
    const permits = await (prisma as any).permitToWork.findMany({
      include: {
        maintenanceJob: {
          include: {
            machine: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    const openJobs = await (prisma as any).maintenanceJob.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      include: { machine: { select: { id: true, name: true, code: true } } },
      orderBy: { openedAt: "desc" },
    });

    return NextResponse.json({ permits, openJobs });
  } catch (error: any) {
    console.error("GET /api/permits error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Admin";
    const user = getUserFromHeaders(headerList);
    if (!can(user, "ehs.edit") && !can(user, "system.edit")) {
      return NextResponse.json(
        { error: "Insufficient role: EHS edit permission required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      maintenanceJobId,
      type,
      description,
      location,
      validFrom,
      validUntil,
    } = body;

    if (
      !maintenanceJobId ||
      !type ||
      !description ||
      !location ||
      !validUntil
    ) {
      return NextResponse.json(
        {
          error:
            "maintenanceJobId, type, description, location and validUntil are required",
        },
        { status: 400 },
      );
    }
    if (!PERMIT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Unknown permit type: ${type}` },
        { status: 400 },
      );
    }

    const job = await (prisma as any).maintenanceJob.findUnique({
      where: { id: maintenanceJobId },
      include: { machine: { select: { name: true } } },
    });
    if (!job) {
      return NextResponse.json(
        { error: "Maintenance job not found" },
        { status: 404 },
      );
    }

    const permitNo = `PTW-${String((await (prisma as any).permitToWork.count()) + 1).padStart(4, "0")}`;

    const permit = await (prisma as any).permitToWork.create({
      data: {
        permitNo,
        maintenanceJobId,
        type,
        description,
        location,
        requestedBy: actor,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: new Date(validUntil),
        status: "PENDING",
      },
      include: {
        maintenanceJob: {
          include: {
            machine: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    await logAudit({
      actor,
      action: "PERMIT_CREATE",
      entityType: "PERMIT_TO_WORK",
      entityId: permit.id,
      details: `Created ${type} permit ${permitNo} for job on ${job.machine.name} (${location}) — ${description}`,
    });

    return NextResponse.json({ permit }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/permits error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
