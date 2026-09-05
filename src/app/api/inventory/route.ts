import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getSettings } from "@/lib/settings";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

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
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
      clientId: bodyClientId,
    } = body;

    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["supply.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }
    const actorName = user.name || headersList.get("x-user-name") || "Storekeeper";
    const headerClientId = headersList.get("x-client-id");
    const clientId: string | null = (bodyClientId ? String(bodyClientId).trim() : null) || (headerClientId ? String(headerClientId).trim() : null);

    // Idempotency fast-path: return cached result without re-executing side effects
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
      }
    }

    const settings = await getSettings();

    if (!rawMaterialId || qty === undefined || qty === null) {
      return NextResponse.json(
        { error: "Raw Material ID and Quantity are required." },
        { status: 400 },
      );
    }

    const numericQty = Number(qty);
    if (!Number.isFinite(numericQty)) {
      return NextResponse.json({ error: "Quantity must be a valid number" }, { status: 400 });
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

    let result: { material: any; transaction: any } | null = null;

    if (action === "IN") {
      if (settings.requireMillCerts && !heatNumber) {
        return NextResponse.json(
          { error: "Heat number is required. requireMillCerts is ON (Aerospace Mode)." },
          { status: 400 },
        );
      }

      const addedQty = Math.abs(numericQty);
      if (addedQty <= 0 || !Number.isFinite(addedQty)) {
        return NextResponse.json({ error: "Quantity must be positive" }, { status: 400 });
      }
      const costPerUnit = unitCost != null && String(unitCost).trim() !== "" ? Number(unitCost) : material.unitCost;
      if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
        return NextResponse.json({ error: "unitCost must be a non-negative number" }, { status: 400 });
      }

      result = await prisma.$transaction(async (tx) => {
        if (clientId) {
          const reserved = await reserveIdempotency(tx as any, clientId, "/api/inventory");
          if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
        }

        // Re-read inside tx to guard against concurrent OUT/ADJUST
        const freshMat = await tx.rawMaterial.findUnique({ where: { id: rawMaterialId } });
        if (!freshMat) throw new Error("Raw Material not found");

        const updatedMaterial = await tx.rawMaterial.update({
          where: { id: rawMaterialId },
          data: { currentStock: { increment: addedQty }, unitCost: costPerUnit },
        });

        const transaction = await tx.inventoryTransaction.create({
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

        if (heatNumber) {
          let fileDataBuf: Buffer | null = null;
          if (certFileBase64) fileDataBuf = Buffer.from(certFileBase64, "base64");
          await (tx as any).materialCert.create({
            data: {
              inventoryTransactionId: transaction.id,
              rawMaterialId,
              supplierId: freshMat.supplierId || null,
              heatNumber: String(heatNumber).trim(),
              certNumber: certNumber ? String(certNumber).trim() : null,
              certType: certType || "MILL_CERT",
              specGrade: specGrade || null,
              mimeType: certMimeType || null,
              fileData: fileDataBuf,
              sizeKb: certSizeKb || null,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
              uploadedBy: actorName,
            },
          });
        }

        await logAuditTx(tx, { actor: actorName, action: "INVENTORY_IN", entityType: "RAW_MATERIAL", entityId: rawMaterialId, details: `IN transaction of ${addedQty} ${freshMat.unit} for ${freshMat.name} (SKU: ${freshMat.sku})` });

        if (heatNumber) {
          await logAuditTx(tx, { actor: actorName, action: "CERT_UPLOADED", entityType: "RAW_MATERIAL", entityId: rawMaterialId, details: `Mill cert uploaded: Heat# ${heatNumber}, Cert# ${certNumber || "N/A"} for ${freshMat.name}` });
        }

        return { material: updatedMaterial, transaction };
      });
    } else if (action === "OUT") {
      const issuedQty = Math.abs(numericQty);
      if (issuedQty <= 0 || !Number.isFinite(issuedQty)) {
        return NextResponse.json({ error: "Quantity must be positive" }, { status: 400 });
      }

      try {
        result = await prisma.$transaction(async (tx) => {
          if (clientId) {
            const reserved = await reserveIdempotency(tx as any, clientId, "/api/inventory");
            if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
          }

          if (settings.requireMillCerts) {
            const uncertifiedIn = await (tx as any).inventoryTransaction.findFirst({
              where: { rawMaterialId, type: "IN", materialCert: null },
            });
            if (uncertifiedIn) {
              await logAuditTx(tx, { actor: actorName, action: "ISSUE_BLOCKED_NO_CERT", entityType: "RAW_MATERIAL", entityId: rawMaterialId, details: `Issuance blocked: ${material.name} has uncertified IN batch (tx: ${uncertifiedIn.id}). requireMillCerts ON.` });
              throw Object.assign(new Error(`ISSUE BLOCKED: ${material.name} has an uncertified batch on file. Attach a Mill Cert before issuing.`), { code: "BLOCKED_NO_CERT" });
            }
          }

          // Atomic conditional decrement: fails if insufficient stock without race window
          const updatedMaterial = await tx.rawMaterial.updateMany({
            where: { id: rawMaterialId, currentStock: { gte: issuedQty } },
            data: { currentStock: { decrement: issuedQty } },
          });
          if (updatedMaterial.count === 0) {
            const fresh = await tx.rawMaterial.findUnique({ where: { id: rawMaterialId }, select: { currentStock: true } });
            throw Object.assign(
              new Error(`Insufficient stock! Requested ${issuedQty} ${material.unit}, but only ${fresh?.currentStock ?? material.currentStock} ${material.unit} available.`),
              { code: "INSUFFICIENT_STOCK" },
            );
          }

          const freshMat = await tx.rawMaterial.findUnique({ where: { id: rawMaterialId } });
          const transaction = await tx.inventoryTransaction.create({
            data: {
              rawMaterialId,
              type: "OUT",
              qty: issuedQty,
              unitCost: freshMat?.unitCost ?? material.unitCost,
              batchNo: batchNo || null,
              reference: reference || (workOrderId ? `WO-ISSUANCE` : "JOB-ISSUE"),
              workOrderId: workOrderId || null,
              actorName,
            },
          });

          await logAuditTx(tx, { actor: actorName, action: "INVENTORY_OUT", entityType: "RAW_MATERIAL", entityId: rawMaterialId, details: `OUT transaction of ${issuedQty} ${freshMat?.unit ?? material.unit} for ${freshMat?.name ?? material.name} (SKU: ${freshMat?.sku ?? material.sku})` });

          return { material: freshMat!, transaction };
        });
      } catch (e: any) {
        if (e?.code === "BLOCKED_NO_CERT") {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        if (e?.code === "INSUFFICIENT_STOCK") {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        if (e?.code === "DUPLICATE") {
          return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
        }
        throw e;
      }
    } else if (action === "ADJUST") {
      const newStock = Math.max(0, numericQty);
      if (!Number.isFinite(newStock)) {
        return NextResponse.json({ error: "new stock must be a finite number" }, { status: 400 });
      }

      result = await prisma.$transaction(async (tx) => {
        if (clientId) {
          const reserved = await reserveIdempotency(tx as any, clientId, "/api/inventory");
          if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
        }

        const freshMat = await tx.rawMaterial.findUnique({ where: { id: rawMaterialId } });
        if (!freshMat) throw new Error("Raw Material not found");
        const deltaQty = newStock - freshMat.currentStock;

        const updatedMaterial = await tx.rawMaterial.update({
          where: { id: rawMaterialId },
          data: { currentStock: newStock },
        });

        const transaction = await tx.inventoryTransaction.create({
          data: {
            rawMaterialId,
            type: "ADJUST",
            qty: deltaQty,
            unitCost: freshMat.unitCost,
            batchNo: batchNo || "PHYSICAL-COUNT",
            reference: reference || "STOCK-ADJUSTMENT",
            actorName,
          },
        });

        await logAuditTx(tx, { actor: actorName, action: "INVENTORY_ADJUST", entityType: "RAW_MATERIAL", entityId: rawMaterialId, details: `ADJUST transaction delta ${deltaQty} ${freshMat.unit} for ${freshMat.name} (SKU: ${freshMat.sku}) -> ${newStock}` });

        return { material: updatedMaterial, transaction };
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Supported: IN, OUT, ADJUST" },
        { status: 400 },
      );
    }

    const payload = { success: true, material: result!.material, transaction: result!.transaction };
    if (clientId) await completeIdempotency(clientId, payload);

    return NextResponse.json(payload);
  } catch (error: any) {
    if (error?.code === "DUPLICATE") {
      return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
    }
    console.error("Error in inventory transaction API:", error);
    return NextResponse.json(
      { error: "Failed to process inventory transaction" },
      { status: 500 },
    );
  }
}
