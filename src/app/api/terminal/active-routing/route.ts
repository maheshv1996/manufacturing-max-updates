import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workOrderId = searchParams.get("workOrderId");
    const serialNumber = searchParams.get("serialNumber"); // Optional

    if (!workOrderId) {
      return NextResponse.json(
        { error: "Missing workOrderId" },
        { status: 400 },
      );
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        product: {
          include: {
            routingSteps: {
              include: { machine: true, operation: true },
              orderBy: { seq: "asc" },
            },
          },
        },
        project: { select: { projectType: true } },
      },
    });

    if (!wo) {
      return NextResponse.json(
        { error: "WorkOrder not found" },
        { status: 404 },
      );
    }

    let effectiveRouting = [...wo.product.routingSteps];
    let appliedRevisions: string[] = [];
    let effectivityPending = false;

    // R&D prototype projects skip strict ECO effectivity gating (rapid iteration mode)
    const isPrototype = wo.project?.projectType === "RND";

    // Fetch implemented ECOs for this product targeting ROUTING
    const ecos = await prisma.eco.findMany({
      where: {
        status: "IMPLEMENTED",
        items: {
          some: { productId: wo.productId, entityType: "ROUTING" },
        },
      },
      include: {
        items: {
          where: { productId: wo.productId, entityType: "ROUTING" },
        },
      },
      orderBy: { implementedAt: "desc" },
    });

    for (const eco of ecos) {
      let isEffective = true;
      if (isPrototype) continue;
      if (eco.effectivityType === "SERIAL") {
        if (!serialNumber) {
          // No serial scanned yet — we cannot prove the new revision applies.
          // Conservatively show the pre-ECO revision until a serial is entered.
          isEffective = false;
          effectivityPending = true;
        } else if (
          serialNumber.localeCompare(eco.effectivityValue, undefined, {
            numeric: true,
            sensitivity: "base",
          }) < 0
        ) {
          isEffective = false;
        }
      } else if (eco.effectivityType === "DATE") {
        const effectivityDate = new Date(eco.effectivityValue).getTime();
        const woDate = new Date(wo.plannedStartDate).getTime();
        if (woDate < effectivityDate) {
          isEffective = false;
        }
      }

      if (!isEffective) {
        // Revert the ECO's ROUTING items
        for (const item of eco.items) {
          if (item.action === "REPLACE" && item.oldData && item.newData) {
            const oldData = item.oldData as any;
            const newData = item.newData as any;

            // Remove the new routing step
            effectiveRouting = effectiveRouting.filter(
              (r) => r.id !== newData.id,
            );

            // Push old routing step back
            if (oldData.id) {
              const oldStep = await prisma.routingStep.findUnique({
                where: { id: oldData.id },
                include: { machine: true, operation: true },
              });
              if (oldStep) {
                effectiveRouting.push(oldStep);
                appliedRevisions.push(
                  `Reverted routing step ${oldStep.seq} (Pre-${eco.ecoNumber})`,
                );
              }
            }
          } else if (item.action === "ADD" && item.newData) {
            const newData = item.newData as any;
            effectiveRouting = effectiveRouting.filter(
              (r) => r.id !== newData.id,
            );
          } else if (item.action === "REMOVE" && item.oldData) {
            const oldData = item.oldData as any;
            if (oldData.id) {
              const oldStep = await prisma.routingStep.findUnique({
                where: { id: oldData.id },
                include: { machine: true, operation: true },
              });
              if (oldStep) {
                effectiveRouting.push(oldStep);
              }
            }
          }
        }
      }
    }

    effectiveRouting.sort((a, b) => a.seq - b.seq);

    return NextResponse.json({
      routingSteps: effectiveRouting,
      appliedRevisions: appliedRevisions,
      effectivityPending,
      prototypeMode: isPrototype,
    });
  } catch (error) {
    console.error("Error fetching active routing:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
