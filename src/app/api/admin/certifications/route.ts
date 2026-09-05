import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !user.isOwner &&
    !can(user, "system.edit") &&
    !can(user, "ops.edit") &&
    !can(user, "quality.view")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const operators = await prisma.user.findMany({
      where: { role: { name: "Operator" } },
      select: { id: true, name: true, username: true },
    });

    const machines = await prisma.machine.findMany({
      select: { id: true, name: true, code: true, isActive: true },
    });

    const certifications = await prisma.certification.findMany({
      include: {
        user: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ operators, machines, certifications });
  } catch (error) {
    console.error("Error fetching certifications data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const userName = user.name || headersList.get("x-user-name") || "ADMIN";

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isOwner && !can(user, "system.edit") && !can(user, "quality.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { userId, machineId, validUntil, notes } = await req.json();

    if (!userId || !machineId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const certification = await prisma.$transaction(async (tx) => {
      const res = await tx.certification.upsert({
        where: {
          userId_machineId: { userId, machineId },
        },
        update: {
          isActive: true,
          validUntil: validUntil ? new Date(validUntil) : null,
          certifiedBy: userName,
          notes,
        },
        create: {
          userId,
          machineId,
          validUntil: validUntil ? new Date(validUntil) : null,
          certifiedBy: userName,
          notes,
          isActive: true,
        },
      });

      await logAuditTx(tx, {
        actor: userName,
        action: "CERTIFICATION_CREATED",
        entityType: "Certification",
        entityId: res.id,
        details: `user ${userId} · machine ${machineId}`,
      });

      return res;
    });

    return NextResponse.json(certification);
  } catch (error) {
    console.error("Error creating certification:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
