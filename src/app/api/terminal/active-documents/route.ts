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
      include: { product: true, project: { select: { projectType: true } } },
    });

    if (!wo) {
      return NextResponse.json(
        { error: "WorkOrder not found" },
        { status: 404 },
      );
    }

    // 1. Fetch current documents
    const currentDocs = await prisma.document.findMany({
      where: {
        productId: wo.productId,
        status: "CURRENT",
      },
      include: { product: true, operation: true },
    });

    // 2. Fetch implemented ECOs for this product
    const ecos = await prisma.eco.findMany({
      where: {
        status: "IMPLEMENTED",
        items: {
          some: { productId: wo.productId, entityType: "DRAWING" },
        },
      },
      include: {
        items: {
          where: { productId: wo.productId, entityType: "DRAWING" },
        },
      },
      orderBy: { implementedAt: "desc" },
    });

    // 3. Evaluate effectivity
    let effectiveDocs = [...currentDocs];
    const appliedRevisions: string[] = [];
    let effectivityPending = false;

    // R&D prototype projects skip strict ECO effectivity gating (rapid iteration mode)
    const isPrototype = wo.project?.projectType === "RND";

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
        for (const item of eco.items) {
          if (
            item.action === "REPLACE" &&
            item.oldData &&
            (item.oldData as any).id
          ) {
            const oldDocId = (item.oldData as any).id;
            const newDocId = (item.newData as any)?.id;

            effectiveDocs = effectiveDocs.filter((d) => d.id !== newDocId);

            const oldDoc = await prisma.document.findUnique({
              where: { id: oldDocId },
              include: { product: true, operation: true },
            });
            if (oldDoc) {
              effectiveDocs.push(oldDoc);
              appliedRevisions.push(
                `Reverted to REV ${oldDoc.version} (Pre-${eco.ecoNumber})`,
              );
            }
          } else if (
            item.action === "ADD" &&
            item.newData &&
            (item.newData as any).id
          ) {
            const newDocId = (item.newData as any).id;
            effectiveDocs = effectiveDocs.filter((d) => d.id !== newDocId);
          } else if (
            item.action === "REMOVE" &&
            item.oldData &&
            (item.oldData as any).id
          ) {
            const oldDocId = (item.oldData as any).id;
            const oldDoc = await prisma.document.findUnique({
              where: { id: oldDocId },
              include: { product: true, operation: true },
            });
            if (oldDoc) {
              effectiveDocs.push(oldDoc);
            }
          }
        }
      }
    }

    // P3 — Drawing transmittal: an unacknowledged revision is NOT authoritative.
    // Attach the ack status so the terminal can flag the doc amber until both
    // Production and Quality managers acknowledge it.
    const docIds = effectiveDocs.map((d: any) => d.id);
    const transmittals = await prisma.drawingTransmittal.findMany({
      where: { documentId: { in: docIds } },
      orderBy: { revision: "desc" },
    });
    const latestByDoc = new Map<string, any>();
    for (const t of transmittals) {
      if (!latestByDoc.has(t.documentId)) latestByDoc.set(t.documentId, t);
    }
    const docsWithAck = (effectiveDocs as any[]).map((d) => {
      const t = latestByDoc.get(d.id);
      const ack = t
        ? {
            status:
              t.ackProduction && t.ackQuality
                ? "FULL"
                : t.ackProduction
                  ? "PENDING_QUALITY"
                  : t.ackQuality
                    ? "PENDING_PRODUCTION"
                    : "PENDING_BOTH",
            revision: t.revision,
            ackProduction: t.ackProduction,
            ackQuality: t.ackQuality,
          }
        : {
            status: "NONE",
            revision: d.version,
            ackProduction: false,
            ackQuality: false,
          };
      return { ...d, transmittal: ack };
    });

    return NextResponse.json({
      documents: docsWithAck,
      appliedRevisions: appliedRevisions,
      effectivityPending,
      prototypeMode: isPrototype,
    });
  } catch (error) {
    console.error("Error fetching active docs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
