import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const tools = await (prisma as any).tool.findMany({
      include: {
        assignedMachine: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tools });
  } catch (error: any) {
    console.error("GET /api/tools error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tooling inventory" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      toolCode,
      name,
      maxLifeCycles,
      warningThreshold,
      assignedMachineId,
    } = body;

    if (!toolCode || !name || !maxLifeCycles) {
      return NextResponse.json(
        { error: "toolCode, name, and maxLifeCycles are required" },
        { status: 400 },
      );
    }

    const tool = await (prisma as any).tool.create({
      data: {
        toolCode,
        name,
        maxLifeCycles: parseInt(String(maxLifeCycles), 10),
        warningThreshold: warningThreshold
          ? parseFloat(String(warningThreshold))
          : 85.0,
        status: "ACTIVE",
        assignedMachineId: assignedMachineId || null,
      },
    });

    await logAudit({
      actor: "system",
      action: "TOOL_CREATED",
      entityType: "Tool",
      entityId: tool.id,
      details: `${toolCode} · ${name} · maxLifeCycles=${maxLifeCycles}`,
    });

    return NextResponse.json({ success: true, tool });
  } catch (error: any) {
    console.error("POST /api/tools error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create tool" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, reset, status, assignedMachineId } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Tool ID is required" },
        { status: 400 },
      );
    }

    const updateData: any = {};

    if (reset) {
      updateData.currentCycles = 0;
      updateData.status = "ACTIVE";
    }

    if (status) {
      updateData.status = status;
    }

    if (assignedMachineId !== undefined) {
      updateData.assignedMachineId = assignedMachineId || null;
    }

    const updatedTool = await (prisma as any).tool.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      actor: "system",
      action: "TOOL_UPDATED",
      entityType: "Tool",
      entityId: id,
      details: `reset=${!!reset} · status=${status} · machine=${assignedMachineId}`,
    });

    return NextResponse.json({ success: true, tool: updatedTool });
  } catch (error: any) {
    console.error("PATCH /api/tools error:", error);
    return NextResponse.json(
      { error: "Failed to update tool" },
      { status: 500 },
    );
  }
}
