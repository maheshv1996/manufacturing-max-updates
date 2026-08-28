import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [materials, workOrders] = await Promise.all([
      prisma.rawMaterial.findMany({
        include: {
          transactions: {
            include: {
              workOrder: {
                select: { woNumber: true },
              },
              materialCert: true,
            },
            orderBy: { at: "desc" },
            take: 20,
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.workOrder.findMany({
        select: { id: true, woNumber: true, status: true, customerName: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({ materials, workOrders });
  } catch (error) {
    console.error("Error fetching inventory data:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      rawMaterialId,
      qty,
      unitCost,
      batchNo,
      reference,
      workOrderId,
      // Mill cert fields
      heatNumber,
      certNumber,
      certType,
      specGrade,
      expiresAt,
      certFileBase64,
      certMimeType,
      certSizeKb,
    } = body;

    const settings = await getSettings();

    if (!rawMaterialId || qty === undefined || qty === null) {
      return NextResponse.json(
        { error: "Raw Material ID and Quantity are required." },
        { status: 400 },
      );
    }

    const material = await prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Raw Material not found." },
        { status: 404 },
      );
    }

    const headersList = await headers();
    const actorName = headersList.get("x-user-name") || "Storekeeper";

    let updatedMaterial;
    let transaction;

    if (action === "IN") {
      // Enforce heat number when requireMillCerts is ON
      if (settings.requireMillCerts && !heatNumber) {
        return NextResponse.json(
          {
            error:
              "Heat number is required. requireMillCerts is ON (Aerospace Mode).",
          },
          { status: 400 },
        );
      }

      const addedQty = Math.abs(Number(qty));
      const costPerUnit = unitCost ? Number(unitCost) : material.unitCost;

      // Update stock & unitCost
      updatedMaterial = await prisma.rawMaterial.update({
        where: { id: rawMaterialId },
        data: {
          currentStock: material.currentStock + addedQty,
          unitCost: costPerUnit,
        },
      });

      transaction = await prisma.inventoryTransaction.create({
        data: {
          rawMaterialId,
          type: "IN",
          qty: addedQty,
          unitCost: costPerUnit,
          batchNo: batchNo || null,
          reference: reference || "PO-RECEIPT",
          actorName,
        },
      });

      // Create MaterialCert if heatNumber provided
      if (heatNumber) {
        let fileDataBuf: Buffer | null = null;
        if (certFileBase64) {
          fileDataBuf = Buffer.from(certFileBase64, "base64");
        }
        await (prisma as any).materialCert.create({
          data: {
            inventoryTransactionId: transaction.id,
            rawMaterialId,
            supplierId: material.supplierId || null,
            heatNumber,
            certNumber: certNumber || null,
            certType: certType || "MILL_CERT",
            specGrade: specGrade || null,
            mimeType: certMimeType || null,
            fileData: fileDataBuf,
            sizeKb: certSizeKb || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            uploadedBy: actorName,
          },
        });
        await logAudit({
          actor: actorName,
          action: "CERT_UPLOADED",
          entityType: "RAW_MATERIAL",
          entityId: rawMaterialId,
          details: `Mill cert uploaded: Heat# ${heatNumber}, Cert# ${certNumber || "N/A"} for ${material.name}`,
        });
      }
    } else if (action === "OUT") {
      // Enforce no-cert block when requireMillCerts is ON
      if (settings.requireMillCerts) {
        const uncertifiedIn = await (
          prisma as any
        ).inventoryTransaction.findFirst({
          where: {
            rawMaterialId,
            type: "IN",
            materialCert: null,
          },
        });
        if (uncertifiedIn) {
          await logAudit({
            actor: actorName,
            action: "ISSUE_BLOCKED_NO_CERT",
            entityType: "RAW_MATERIAL",
            entityId: rawMaterialId,
            details: `Issuance blocked: ${material.name} (SKU: ${material.sku}) has uncertified IN batch (tx: ${uncertifiedIn.id}). requireMillCerts is ON.`,
          });
          return NextResponse.json(
            {
              error: `ISSUE BLOCKED: ${material.name} has an uncertified batch on file. Attach a Mill Cert before issuing.`,
            },
            { status: 400 },
          );
        }
      }

      const issuedQty = Math.abs(Number(qty));

      if (material.currentStock < issuedQty) {
        return NextResponse.json(
          {
            error: `Insufficient stock! Requested ${issuedQty} ${material.unit}, but only ${material.currentStock} ${material.unit} available.`,
          },
          { status: 400 },
        );
      }

      updatedMaterial = await prisma.rawMaterial.update({
        where: { id: rawMaterialId },
        data: {
          currentStock: Math.max(0, material.currentStock - issuedQty),
        },
      });

      transaction = await prisma.inventoryTransaction.create({
        data: {
          rawMaterialId,
          type: "OUT",
          qty: issuedQty,
          unitCost: material.unitCost,
          batchNo: batchNo || null,
          reference: reference || (workOrderId ? `WO-ISSUANCE` : "JOB-ISSUE"),
          workOrderId: workOrderId || null,
          actorName,
        },
      });
    } else if (action === "ADJUST") {
      const newStock = Math.max(0, Number(qty));
      const deltaQty = newStock - material.currentStock;

      updatedMaterial = await prisma.rawMaterial.update({
        where: { id: rawMaterialId },
        data: {
          currentStock: newStock,
        },
      });

      transaction = await prisma.inventoryTransaction.create({
        data: {
          rawMaterialId,
          type: "ADJUST",
          qty: deltaQty,
          unitCost: material.unitCost,
          batchNo: batchNo || "PHYSICAL-COUNT",
          reference: reference || "STOCK-ADJUSTMENT",
          actorName,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Supported: IN, OUT, ADJUST" },
        { status: 400 },
      );
    }

    await logAudit({
      actor: actorName,
      action: `INVENTORY_${action}`,
      entityType: "RAW_MATERIAL",
      entityId: rawMaterialId,
      details: `${action} transaction of ${qty} ${material.unit} for ${material.name} (SKU: ${material.sku})`,
    });

    return NextResponse.json({
      success: true,
      material: updatedMaterial,
      transaction,
    });
  } catch (error: any) {
    console.error("Error in inventory transaction API:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process inventory transaction" },
      { status: 500 },
    );
  }
}
