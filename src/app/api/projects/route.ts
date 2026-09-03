import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { classifyProjectRisk } from "@/lib/programHealth";
import {
  calculateProjectCompletionPercentage,
  calculateMachineLoadHours,
  analyzeProjectBottlenecks,
} from "@/lib/projectEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
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
            productionLogs: {
              select: { goodQuantity: true, scrapQuantity: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        milestones: { orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const enrichedProjects = projects.map((project) => {
      const derivedCompletionPct = calculateProjectCompletionPercentage(
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

      return {
        ...project,
        completionPercentage: derivedCompletionPct,
        machineLoads,
        bottlenecks,
        health: classifyProjectRisk(project),
      };
    });

    // Also return list of machines and products for project creation modal dropdowns
    const machines = await prisma.machine.findMany({
      orderBy: { code: "asc" },
    });
    const products = await prisma.product.findMany({
      include: {
        routingSteps: {
          include: { machine: true, operation: true },
          orderBy: { seq: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    const operations = await prisma.operation.findMany({
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      projects: enrichedProjects,
      machines,
      products,
      operations,
    });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const {
      name,
      code,
      clientName,
      targetCompletionDate,
      status = "OPEN",
      description,
      workOrders = [], // Existing WO IDs to link
      batchWorkOrders = [], // New sub-component WOs with multi-op routing steps to create
    } = body;

    if (!name || !clientName || !targetCompletionDate) {
      return NextResponse.json(
        {
          error:
            "Project name, client name, and target completion date are required.",
        },
        { status: 400 },
      );
    }

    const projectCode = code || `PRJ-${Date.now().toString().slice(-6)}`;

    // Create the Project entity
    const newProject = await prisma.project.create({
      data: {
        name,
        code: projectCode,
        clientName,
        targetCompletionDate: new Date(targetCompletionDate),
        status,
        description: description || null,
        completionPercentage: 0.0,
      },
    });

    // 1. Link any existing work orders
    if (Array.isArray(workOrders) && workOrders.length > 0) {
      await prisma.workOrder.updateMany({
        where: { id: { in: workOrders } },
        data: { projectId: newProject.id },
      });
    }

    // 2. Create batch sub-component Work Orders with sequential machine routing steps
    if (Array.isArray(batchWorkOrders) && batchWorkOrders.length > 0) {
      for (const bWo of batchWorkOrders) {
        const {
          woNumber,
          productId,
          plannedQuantity,
          plannedStartDate,
          plannedEndDate,
          routingSteps = [],
        } = bWo;

        if (!productId || !plannedQuantity) continue;

        // If custom routing steps supplied, create or update Product's routing steps
        if (Array.isArray(routingSteps) && routingSteps.length > 0) {
          // Clean existing routing steps for product or add/update
          for (let i = 0; i < routingSteps.length; i++) {
            const step = routingSteps[i];
            const seq = step.seq || i + 1;
            const opCode = step.operationCode || `OP${seq * 10}`;

            // Find or create operation
            let op = await prisma.operation.findUnique({
              where: { code: opCode },
            });
            if (!op) {
              op = await prisma.operation.create({
                data: {
                  code: opCode,
                  name: step.operationName || `Operation ${opCode}`,
                  defaultCycleTimeSeconds: (step.cycleTimeMin || 2.5) * 60,
                },
              });
            }

            // Upsert routing step for product
            await prisma.routingStep.upsert({
              where: {
                productId_seq: { productId, seq },
              },
              create: {
                productId,
                operationId: op.id,
                seq,
                stationName: step.stationName || "Production Bay",
                machineId: step.machineId || null,
                setupTimeMin: step.setupTimeMin ?? 15,
                cycleTimeMin: step.cycleTimeMin ?? 2.5,
                instructions: step.instructions || null,
              },
              update: {
                operationId: op.id,
                stationName: step.stationName || "Production Bay",
                machineId: step.machineId || null,
                setupTimeMin: step.setupTimeMin ?? 15,
                cycleTimeMin: step.cycleTimeMin ?? 2.5,
                instructions: step.instructions || null,
              },
            });
          }
        }

        const woNum =
          woNumber ||
          `WO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
        const startDate = plannedStartDate
          ? new Date(plannedStartDate)
          : new Date();
        const endDate = plannedEndDate
          ? new Date(plannedEndDate)
          : new Date(Date.now() + 7 * 24 * 3600 * 1000);

        await prisma.workOrder.create({
          data: {
            woNumber: woNum,
            productId,
            plannedQuantity: parseInt(String(plannedQuantity), 10),
            status: "PLANNED",
            plannedStartDate: startDate,
            plannedEndDate: endDate,
            currentSeq: 1,
            projectId: newProject.id,
          },
        });
      }
    }

    // Recalculate derived completion percentage
    const updatedProject = await prisma.project.findUnique({
      where: { id: newProject.id },
      include: {
        workOrders: {
          include: {
            product: {
              include: {
                routingSteps: {
                  include: { machine: true, operation: true },
                  orderBy: { seq: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (updatedProject) {
      const completionPercentage = calculateProjectCompletionPercentage(
        updatedProject.workOrders,
      );
      await prisma.project.update({
        where: { id: newProject.id },
        data: { completionPercentage },
      });
    }

    const reqHeaders = await headers();
    const actor = reqHeaders.get("x-user-name") || "Admin";
    await logAudit({
      actor,
      action: "CREATE_PROJECT",
      entityType: "PROJECT",
      entityId: newProject.id,
      details: `Created project "${newProject.name}" for client "${newProject.clientName}"`,
    });

    return NextResponse.json(
      { success: true, project: newProject },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
