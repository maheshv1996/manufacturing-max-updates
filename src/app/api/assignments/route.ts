import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "ops.edit") && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "System";

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { machineId, operatorId, shiftId, validFrom, validTo } = body;

    if (!machineId || !operatorId || !shiftId) {
      return NextResponse.json(
        { error: "Machine, operator, and shift are required." },
        { status: 400 },
      );
    }

    const assignment = await prisma.$transaction(async (tx) => {
      // Deactivate any existing active assignment for this operator + shift
      await tx.assignment.updateMany({
        where: {
          operatorId,
          shiftId,
          status: "ACTIVE",
        },
        data: {
          status: "INACTIVE",
          validTo: new Date(),
        },
      });

      // Create new active assignment
      const created = await tx.assignment.create({
        data: {
          machineId,
          operatorId,
          shiftId,
          validFrom: validFrom ? new Date(validFrom) : new Date(),
          validTo: validTo ? new Date(validTo) : null,
          status: "ACTIVE",
        },
        include: {
          machine: true,
          operator: true,
          shift: true,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "ASSIGNMENT_CREATED",
        entityType: "Assignment",
        entityId: created.id,
        details: `machine ${machineId} · operator ${operatorId} · shift ${shiftId}`,
      });

      return created;
    });

    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error("Assignment create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "ops.edit") && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "System";

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Assignment ID is required." },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.assignment.delete({
        where: { id },
      });

      await logAuditTx(tx, {
        actor,
        action: "ASSIGNMENT_DELETED",
        entityType: "Assignment",
        entityId: id,
        details: `deleted assignment ${id}`,
        severity: "WARN",
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Assignment delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
