import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { machineId, operatorId, shiftId, validFrom, validTo } = body;

    if (!machineId || !operatorId || !shiftId) {
      return NextResponse.json(
        { error: "Machine, operator, and shift are required." },
        { status: 400 },
      );
    }

    // Deactivate any existing active assignment for this operator + shift
    await prisma.assignment.updateMany({
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
    const assignment = await prisma.assignment.create({
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

    await logAudit({
      actor: "system",
      action: "ASSIGNMENT_CREATED",
      entityType: "Assignment",
      entityId: assignment.id,
      details: `machine ${machineId} · operator ${operatorId} · shift ${shiftId}`,
    });

    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error("Assignment create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Assignment ID is required." },
        { status: 400 },
      );
    }

    await prisma.assignment.delete({
      where: { id },
    });

    await logAudit({
      actor: "system",
      action: "ASSIGNMENT_DELETED",
      entityType: "Assignment",
      entityId: id,
      details: `deleted assignment ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Assignment delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
