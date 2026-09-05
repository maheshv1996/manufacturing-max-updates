import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !can(user, "ops.edit") &&
      !can(user, "system.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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

    const actor = user.name || headerList.get("x-user-name") || "Operator";

    const tool = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).tool.create({
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

      await logAuditTx(tx, {
        actor,
        action: "TOOL_CREATED",
        entityType: "Tool",
        entityId: created.id,
        details: `${toolCode} · ${name} · maxLifeCycles=${maxLifeCycles}`,
      });

      return created;
    });

    return NextResponse.json({ success: true, tool });
  } catch (error: any) {
    console.error("POST /api/tools error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !can(user, "ops.edit") &&
      !can(user, "system.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, reset, status, assignedMachineId } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Tool ID is required" },
        { status: 400 },
      );
    }

    const actor = user.name || headerList.get("x-user-name") || "Operator";

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

    const updatedTool = await prisma.$transaction(async (tx) => {
      const u = await (tx as any).tool.update({
        where: { id },
        data: updateData,
      });

      await logAuditTx(tx, {
        actor,
        action: "TOOL_UPDATED",
        entityType: "Tool",
        entityId: id,
        details: `reset=${!!reset} · status=${status} · machine=${assignedMachineId}`,
      });

      return u;
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
