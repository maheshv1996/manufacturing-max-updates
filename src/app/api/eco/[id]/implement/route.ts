import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EcoStatus } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { implementedBy = "System" } = body;

    const eco = await prisma.eco.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!eco) {
      return NextResponse.json({ error: "ECO not found" }, { status: 404 });
    }
    if (eco.status !== "APPROVED") {
      return NextResponse.json(
        { error: "ECO must be APPROVED to implement" },
        { status: 400 },
      );
    }

    const updatedEco = await prisma.$transaction(async (tx) => {
      // Process each item
      for (const item of eco.items) {
        if (item.entityType === "DRAWING") {
          const newData = item.newData as any; // expected { title, mimeType, fileData, sizeKb, ... }
          if (item.action === "REPLACE" || item.action === "ADD") {
            // Archive existing drawing(s) for this product
            await tx.document.updateMany({
              where: { productId: item.productId, status: "CURRENT" },
              data: { status: "ARCHIVED" },
            });
            // Add the new drawing if data is provided
            if (newData && newData.fileData) {
              await tx.document.create({
                data: {
                  productId: item.productId,
                  title: newData.title || `Drawing for ${item.productId}`,
                  mimeType: newData.mimeType || "application/pdf",
                  fileData: Buffer.from(newData.fileData, "base64"),
                  sizeKb: newData.sizeKb || 0,
                  version: (newData.version || 1) + 1,
                  status: "CURRENT",
                  uploadedBy: implementedBy,
                },
              });
            }
          } else if (item.action === "REMOVE") {
            await tx.document.updateMany({
              where: { productId: item.productId, status: "CURRENT" },
              data: { status: "ARCHIVED" },
            });
          }
        } else if (item.entityType === "BOM") {
          const newData = item.newData as any; // expected { rawMaterialId, qtyPerUnit }
          if (item.action === "ADD" || item.action === "REPLACE") {
            if (newData && newData.rawMaterialId) {
              await tx.bomLine.upsert({
                where: {
                  productId_rawMaterialId: {
                    productId: item.productId,
                    rawMaterialId: newData.rawMaterialId,
                  },
                },
                update: { qtyPerUnit: newData.qtyPerUnit },
                create: {
                  productId: item.productId,
                  rawMaterialId: newData.rawMaterialId,
                  qtyPerUnit: newData.qtyPerUnit,
                },
              });
            }
          } else if (item.action === "REMOVE") {
            const oldData = item.oldData as any;
            if (oldData && oldData.rawMaterialId) {
              await tx.bomLine.deleteMany({
                where: {
                  productId: item.productId,
                  rawMaterialId: oldData.rawMaterialId,
                },
              });
            }
          }
        } else if (item.entityType === "ROUTING") {
          const newData = item.newData as any;
          const oldData = item.oldData as any;

          if (item.action === "ADD" && newData) {
            await tx.routingStep.create({
              data: {
                productId: item.productId,
                seq: newData.sequence || newData.seq,
                operationId: newData.operationId,
                machineId: newData.machineId,
                stationName: newData.stationName || "Unknown Station",
                isHoldPoint: newData.isHoldPoint || false,
                holdAuthority: newData.holdAuthority,
              },
            });
          } else if (item.action === "REMOVE" && oldData && oldData.id) {
            await tx.routingStep.delete({
              where: { id: oldData.id },
            });
          } else if (
            item.action === "REPLACE" &&
            newData &&
            oldData &&
            oldData.id
          ) {
            await tx.routingStep.update({
              where: { id: oldData.id },
              data: {
                seq: newData.sequence || newData.seq,
                operationId: newData.operationId,
                machineId: newData.machineId,
                stationName: newData.stationName,
                isHoldPoint: newData.isHoldPoint,
                holdAuthority: newData.holdAuthority,
              },
            });
          }
        }
      }

      const ecoResult = await tx.eco.update({
        where: { id },
        data: {
          status: "IMPLEMENTED" as EcoStatus,
          implementedAt: new Date(),
        },
      });

      // Write audit log inside the same transaction
      await logAuditTx(tx, {
        actor: implementedBy,
        action: "ECO_IMPLEMENTED",
        entityType: "ECO",
        entityId: id,
        details: `Implemented ECO ${eco.ecoNumber}`,
      });

      return ecoResult;
    });

    revalidatePath("/eco");
    revalidatePath(`/eco/${id}`);

    return NextResponse.json({ success: true, eco: updatedEco });
  } catch (error) {
    console.error("POST /api/eco/[id]/implement error:", error);
    return NextResponse.json(
      { error: "Failed to implement ECO" },
      { status: 500 },
    );
  }
}
