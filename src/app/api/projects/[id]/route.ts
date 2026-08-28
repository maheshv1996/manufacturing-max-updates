import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import {
  calculateProjectCompletionPercentage,
  calculateMachineLoadHours,
  analyzeProjectBottlenecks,
} from "@/lib/projectEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        workOrders: {
          include: {
            product: {
              include: {
                routingSteps: {
                  include: {
                    machine: true,
                    operation: true,
                  },
                  orderBy: { seq: "asc" },
                },
              },
            },
            productionLogs: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const completionPercentage = calculateProjectCompletionPercentage(
      project.workOrders,
    );
    const machineLoads = calculateMachineLoadHours(project.workOrders);
    const bottlenecks = analyzeProjectBottlenecks(
      {
        id: project.id,
        name: project.name,
        targetCompletionDate: project.targetCompletionDate,
        status: project.status,
        workOrders: project.workOrders,
      },
      machineLoads,
    );

    return NextResponse.json({
      project: {
        ...project,
        completionPercentage,
        machineLoads,
        bottlenecks,
      },
    });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // P29 — milestone actions on the program
    const { action, name, dueDate, milestoneId, salesOwner } = body;
    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Admin";
    if (action === "add-milestone") {
      if (!name || !dueDate) {
        return NextResponse.json(
          { error: "Milestone name and dueDate required" },
          { status: 400 },
        );
      }
      const milestone = await prisma.projectMilestone.create({
        data: { projectId: id, name, dueDate: new Date(dueDate) },
      });
      await logAudit({
        actor,
        action: "MILESTONE_CREATE",
        entityType: "PROJECT",
        entityId: id,
        details: `Added milestone "${name}" due ${new Date(dueDate).toLocaleDateString()}`,
      });
      return NextResponse.json({ milestone });
    }
    if (action === "complete-milestone") {
      if (!milestoneId) {
        return NextResponse.json(
          { error: "milestoneId required" },
          { status: 400 },
        );
      }
      const milestone = await prisma.projectMilestone.update({
        where: { id: milestoneId, projectId: id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completedBy: actor,
        },
      });
      await logAudit({
        actor,
        action: "MILESTONE_COMPLETE",
        entityType: "PROJECT",
        entityId: id,
        details: `Completed milestone "${milestone.name}"`,
      });
      return NextResponse.json({ milestone });
    }

    const {
      name: pName,
      clientName,
      targetCompletionDate,
      status,
      description,
      linkWorkOrderIds, // IDs of Work Orders to assign to this project
      unlinkWorkOrderIds, // IDs of Work Orders to remove from this project
    } = body;

    const updateData: Record<string, any> = {};
    if (pName !== undefined) updateData.name = pName;
    if (salesOwner !== undefined) updateData.salesOwner = salesOwner;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (targetCompletionDate !== undefined)
      updateData.targetCompletionDate = new Date(targetCompletionDate);
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;

    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    if (Array.isArray(linkWorkOrderIds) && linkWorkOrderIds.length > 0) {
      await prisma.workOrder.updateMany({
        where: { id: { in: linkWorkOrderIds } },
        data: { projectId: id },
      });
    }

    if (Array.isArray(unlinkWorkOrderIds) && unlinkWorkOrderIds.length > 0) {
      await prisma.workOrder.updateMany({
        where: { id: { in: unlinkWorkOrderIds } },
        data: { projectId: null },
      });
    }

    // Recalculate derived completion percentage
    const reFetched = await prisma.project.findUnique({
      where: { id },
      include: {
        workOrders: {
          include: {
            product: {
              include: {
                routingSteps: true,
              },
            },
          },
        },
      },
    });

    if (reFetched) {
      const completionPercentage = calculateProjectCompletionPercentage(
        reFetched.workOrders,
      );
      await prisma.project.update({
        where: { id },
        data: { completionPercentage },
      });
    }

    const reqHeaders2 = await headers();
    const updateActor = reqHeaders2.get("x-user-name") || "Admin";
    await logAudit({
      actor: updateActor,
      action: "UPDATE_PROJECT",
      entityType: "PROJECT",
      entityId: id,
      details: `Updated project "${updatedProject.name}"`,
    });

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Unlink work orders before deleting project
    await prisma.workOrder.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });

    const deleted = await prisma.project.delete({
      where: { id },
    });

    const reqHeaders = await headers();
    const actor = reqHeaders.get("x-user-name") || "Admin";
    await logAudit({
      actor,
      action: "DELETE_PROJECT",
      entityType: "PROJECT",
      entityId: id,
      details: `Deleted project "${deleted.name}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
