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
            bomLines: {
              include: { rawMaterial: true },
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

    let effectiveBom = [...wo.product.bomLines];
    const appliedRevisions: string[] = [];
    let effectivityPending = false;

    // R&D prototype projects skip strict ECO effectivity gating (rapid iteration mode)
    const isPrototype = wo.project?.projectType === "RND";

    // Fetch implemented ECOs for this product targeting BOM
    const ecos = await prisma.eco.findMany({
      where: {
        status: "IMPLEMENTED",
        items: {
          some: { productId: wo.productId, entityType: "BOM" },
        },
      },
      include: {
        items: {
          where: { productId: wo.productId, entityType: "BOM" },
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
        // Revert the ECO's BOM items
        for (const item of eco.items) {
          if (item.action === "REPLACE" && item.oldData && item.newData) {
            const oldData = item.oldData as any;
            const newData = item.newData as any;

            // Remove the new BOM line
            effectiveBom = effectiveBom.filter((r) => r.id !== newData.id);

            // Push old BOM line back
            if (oldData.id) {
              const oldBom = await prisma.bomLine.findUnique({
                where: { id: oldData.id },
                include: { rawMaterial: true },
              });
              if (oldBom) {
                effectiveBom.push(oldBom);
                appliedRevisions.push(
                  `Reverted BOM line ${oldBom.rawMaterial.sku} (Pre-${eco.ecoNumber})`,
                );
              }
            }
          } else if (item.action === "ADD" && item.newData) {
            const newData = item.newData as any;
            effectiveBom = effectiveBom.filter((r) => r.id !== newData.id);
          } else if (item.action === "REMOVE" && item.oldData) {
            const oldData = item.oldData as any;
            if (oldData.id) {
              const oldBom = await prisma.bomLine.findUnique({
                where: { id: oldData.id },
                include: { rawMaterial: true },
              });
              if (oldBom) {
                effectiveBom.push(oldBom);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      bomLines: effectiveBom,
      appliedRevisions: appliedRevisions,
      effectivityPending,
      prototypeMode: isPrototype,
    });
  } catch (error) {
    console.error("Error fetching active bom:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
