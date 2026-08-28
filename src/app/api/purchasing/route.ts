import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { approvalFor } from "@/lib/poApproval";

export async function GET() {
  try {
    const [purchaseOrders, suppliers, rawMaterials] = await Promise.all([
      prisma.purchaseOrder.findMany({
        include: {
          supplier: true,
          rawMaterial: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.supplier.findMany({
        include: {
          rawMaterials: true,
          purchaseOrders: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.rawMaterial.findMany({
        include: {
          supplier: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // Compute Supplier Scorecard Metrics
    const supplierScorecards = suppliers.map((s) => {
      const pos = s.purchaseOrders || [];
      const totalPOs = pos.length;
      const receivedPOs = pos.filter((p) => p.status === "RECEIVED");
      const onTimePOs = receivedPOs.filter(
        (p) =>
          p.receivedAt &&
          p.expectedDate &&
          new Date(p.receivedAt) <= new Date(p.expectedDate),
      );

      const onTimePct =
        receivedPOs.length > 0
          ? Math.round((onTimePOs.length / receivedPOs.length) * 100)
          : 100;

      const leadDaysSum = receivedPOs.reduce((acc, p) => {
        if (!p.receivedAt) return acc + (s.defaultLeadDays || 7);
        const days =
          (new Date(p.receivedAt).getTime() - new Date(p.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);
        return acc + Math.max(0.5, days);
      }, 0);

      const avgLeadDays =
        receivedPOs.length > 0
          ? parseFloat((leadDaysSum / receivedPOs.length).toFixed(1))
          : s.defaultLeadDays || 7;

      const totalSpend = pos
        .filter((p) => p.status !== "CANCELLED")
        .reduce(
          (acc, p) =>
            acc +
            (p.status === "RECEIVED" ? p.receivedQty : p.qty) * p.unitCost,
          0,
        );

      return {
        supplier: s,
        totalPOs,
        onTimePct,
        avgLeadDays,
        totalSpend,
      };
    });

    return NextResponse.json({
      purchaseOrders,
      suppliers,
      supplierScorecards,
      rawMaterials,
    });
  } catch (error) {
    console.error("Error fetching purchasing data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const actorName = headersList.get("x-user-name") || "Admin";

    const body = await req.json();
    const { action } = body;

    if (action === "CREATE_PO") {
      const { supplierId, rawMaterialId, qty, unitCost, expectedDate } = body;

      if (!supplierId || !rawMaterialId || !qty || !unitCost) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 },
        );
      }

      const year = new Date().getFullYear();
      const count = await prisma.purchaseOrder.count();
      const poSeq = String(count + 1).padStart(3, "0");
      const poNumber = `PO-${year}-${poSeq}`;

      const rawMat = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId },
      });
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      const qtyNum = parseFloat(qty);
      const costNum = parseFloat(unitCost);
      const total = qtyNum * costNum;
      const approval = approvalFor(total);

      const newPO = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          rawMaterialId,
          qty: qtyNum,
          unitCost: costNum,
          status: "ORDERED",
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          createdBy: actorName,
          approvalStatus: approval.approvalStatus,
          approvalLevel: approval.approvalLevel,
        },
        include: {
          supplier: true,
          rawMaterial: true,
        },
      });

      await logAudit({
        actor: actorName,
        action: "PO_CREATED",
        entityType: "PURCHASE_ORDER",
        entityId: newPO.id,
        details: `Created ${poNumber} for ${rawMat?.name || "Material"} (${qtyNum} units from ${supplier?.name || "Supplier"}, ₹${total.toLocaleString("en-IN")}) → ${approval.approvalStatus}${approval.approvalStatus !== "APPROVED" ? " (needs " + approval.approvalLevel + " approval)" : ""}`,
      });

      return NextResponse.json({ success: true, purchaseOrder: newPO });
    }

    if (action === "APPROVE_PO" || action === "REJECT_PO") {
      const { poId, reason } = body;

      if (!poId) {
        return NextResponse.json({ error: "Missing poId" }, { status: 400 });
      }
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          {
            error:
              "A written reason is required for approvals and rejections (audit trail).",
          },
          { status: 400 },
        );
      }

      const headersList = await headers();
      const actor = headersList.get("x-user-name") || "Admin";
      const user = getUserFromHeaders(headersList);
      const isManager =
        user?.isOwner ||
        user?.level === "MANAGER" ||
        canAny(user, ["commercial.edit", "supply.edit"]);

      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { supplier: true, rawMaterial: true },
      });
      if (!po) {
        return NextResponse.json({ error: "PO not found" }, { status: 404 });
      }

      if (action === "APPROVE_PO") {
        if (
          po.approvalStatus !== "PENDING_MANAGER" &&
          po.approvalStatus !== "PENDING_OWNER"
        ) {
          return NextResponse.json(
            {
              error: `PO ${po.poNumber} is not awaiting approval (current: ${po.approvalStatus})`,
            },
            { status: 400 },
          );
        }
        if (po.approvalStatus === "PENDING_OWNER" && !user?.isOwner) {
          return NextResponse.json(
            {
              error:
                "Owner approval required — POs above ₹5,00,000 can only be approved by the owner.",
            },
            { status: 403 },
          );
        }
        if (po.approvalStatus === "PENDING_MANAGER" && !isManager) {
          return NextResponse.json(
            { error: "Manager approval required — this PO is above ₹50,000." },
            { status: 403 },
          );
        }

        const patch: any = {
          approvalStatus: "APPROVED",
          ...(po.approvalStatus === "PENDING_OWNER"
            ? { ownerApprovedBy: actor, ownerApprovedAt: new Date() }
            : { managerApprovedBy: actor, managerApprovedAt: new Date() }),
        };
        const updatedPO = await prisma.purchaseOrder.update({
          where: { id: poId },
          data: patch,
          include: { supplier: true, rawMaterial: true },
        });

        await logAudit({
          actor,
          action: "PO_APPROVED",
          entityType: "PURCHASE_ORDER",
          entityId: po.id,
          details: `Approved ${po.poNumber} (${po.approvalStatus} → APPROVED, ₹${(po.qty * po.unitCost).toLocaleString("en-IN")}) by ${po.approvalStatus === "PENDING_OWNER" ? "owner" : "manager"}. Reason: ${reason}`,
        });

        return NextResponse.json({ success: true, purchaseOrder: updatedPO });
      }

      if (po.approvalStatus === "APPROVED") {
        return NextResponse.json(
          {
            error: `PO ${po.poNumber} is already approved and cannot be rejected`,
          },
          { status: 400 },
        );
      }
      if (!isManager) {
        return NextResponse.json(
          { error: "Manager approval required for rejections." },
          { status: 403 },
        );
      }

      const rejectedPO = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          approvalStatus: "REJECTED",
          rejectedBy: actor,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
        include: { supplier: true, rawMaterial: true },
      });

      await logAudit({
        actor,
        action: "PO_REJECTED",
        entityType: "PURCHASE_ORDER",
        entityId: po.id,
        details: `Rejected ${po.poNumber} (₹${(po.qty * po.unitCost).toLocaleString("en-IN")}). Reason: ${reason}`,
      });

      return NextResponse.json({ success: true, purchaseOrder: rejectedPO });
    }

    if (action === "RECEIVE_PO") {
      const { poId, receiveQty, batchNo } = body;

      if (!poId || !receiveQty || parseFloat(receiveQty) <= 0) {
        return NextResponse.json(
          { error: "Invalid receive quantity" },
          { status: 400 },
        );
      }

      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { rawMaterial: true, supplier: true },
      });

      if (!po) {
        return NextResponse.json({ error: "PO not found" }, { status: 404 });
      }

      if (po.status === "CANCELLED" || po.status === "RECEIVED") {
        return NextResponse.json(
          { error: `Cannot receive items for PO in status ${po.status}` },
          { status: 400 },
        );
      }

      if (po.approvalStatus !== "APPROVED") {
        return NextResponse.json(
          {
            error: `PO_PENDING_APPROVAL: ${po.poNumber} cannot be received — approval status is ${po.approvalStatus}`,
          },
          { status: 400 },
        );
      }

      const addQty = parseFloat(receiveQty);
      const newReceivedQty = po.receivedQty + addQty;
      const isFullyReceived = newReceivedQty >= po.qty;
      const newStatus = isFullyReceived ? "RECEIVED" : "PARTIAL";
      const now = new Date();

      // Update PO
      const updatedPO = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          receivedQty: newReceivedQty,
          status: newStatus,
          receivedAt: isFullyReceived ? po.receivedAt || now : po.receivedAt,
        },
        include: {
          supplier: true,
          rawMaterial: true,
        },
      });

      // Create Inventory IN Transaction
      await prisma.inventoryTransaction.create({
        data: {
          rawMaterialId: po.rawMaterialId,
          type: "IN",
          qty: addQty,
          unitCost: po.unitCost,
          batchNo: batchNo || `BATCH-PO-${po.poNumber}`,
          reference: po.poNumber,
          actorName: actorName,
          at: now,
        },
      });

      // Increase RawMaterial current stock
      await prisma.rawMaterial.update({
        where: { id: po.rawMaterialId },
        data: {
          currentStock: { increment: addQty },
        },
      });

      await logAudit({
        actor: actorName,
        action: "PO_RECEIVED",
        entityType: "PURCHASE_ORDER",
        entityId: po.id,
        details: `Received ${addQty} units for ${po.poNumber} (Batch: ${batchNo || "N/A"}). PO Status: ${newStatus}`,
      });

      return NextResponse.json({ success: true, purchaseOrder: updatedPO });
    }

    if (action === "CANCEL_PO") {
      const { poId } = body;

      if (!poId) {
        return NextResponse.json({ error: "Missing poId" }, { status: 400 });
      }

      const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
      if (!po) {
        return NextResponse.json({ error: "PO not found" }, { status: 404 });
      }

      const cancelledPO = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: "CANCELLED" },
      });

      await logAudit({
        actor: actorName,
        action: "PO_CANCELLED",
        entityType: "PURCHASE_ORDER",
        entityId: po.id,
        details: `Cancelled purchase order ${po.poNumber}`,
      });

      return NextResponse.json({ success: true, purchaseOrder: cancelledPO });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Purchasing API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
