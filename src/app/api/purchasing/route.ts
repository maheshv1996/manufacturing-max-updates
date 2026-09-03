import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { approvalFor } from "@/lib/poApproval";
import { parseOr400, createPoSchema } from "@/lib/validate";
import { nextSequenceTx } from "@/lib/sequence";
import { normalizePoItems, poItemsTotal, poOrderedValue } from "@/lib/poLines";

export async function GET() {
  try {
    const [purchaseOrders, suppliers, rawMaterials] = await Promise.all([
      prisma.purchaseOrder.findMany({
        include: {
          supplier: true,
          rawMaterial: true,
          lines: {
            include: {
              rawMaterial: {
                select: { id: true, sku: true, name: true, unit: true },
              },
            },
            orderBy: { lineNo: "asc" },
          },
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
        .reduce((acc, p: any) => {
          const recognized = p.lines?.length
            ? p.lines.reduce(
                (s: number, l: any) =>
                  s +
                  (p.status === "RECEIVED" ? l.receivedQty || 0 : l.qty) *
                    l.unitCost,
                0,
              )
            : (p.status === "RECEIVED" ? p.receivedQty : p.qty) * p.unitCost;
          return acc + recognized;
        }, 0);

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
      // Accept the new multi-line `items: [...]` payload OR the legacy
      // single-material shape (rawMaterialId / qty / unitCost).
      const supplierId = body?.supplierId;
      let expectedDate: string | null | undefined = body?.expectedDate;
      let items: ReturnType<typeof normalizePoItems>;
      try {
        if (Array.isArray(body?.items) && body.items.length > 0) {
          if (!supplierId) {
            return NextResponse.json({ error: "supplierId required" }, { status: 400 });
          }
          items = normalizePoItems(body);
        } else {
          const parsed = parseOr400(createPoSchema, body);
          if (!parsed.ok) return parsed.response;
          expectedDate = parsed.data.expectedDate;
          items = normalizePoItems({
            rawMaterialId: parsed.data.rawMaterialId,
            qty: parsed.data.qty,
            unitCost: parsed.data.unitCost,
          });
        }
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Invalid PO lines" }, { status: 400 });
      }
      if (!supplierId) {
        return NextResponse.json({ error: "supplierId required" }, { status: 400 });
      }

      // Validate FKs before tx (for 404 semantics) — supplier + every material
      const supplier = await prisma.supplier.findUnique({ where: { id: String(supplierId) } });
      if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
      const materialIds = [...new Set(items.map((it) => it.rawMaterialId))];
      const materials = await prisma.rawMaterial.findMany({
        where: { id: { in: materialIds } },
        select: { id: true, name: true, unit: true },
      });
      if (materials.length !== materialIds.length) {
        return NextResponse.json({ error: "One or more raw materials not found" }, { status: 404 });
      }
      const byId = new Map(materials.map((m) => [m.id, m]));

      const total = poItemsTotal(items);
      const approval = approvalFor(total);
      const first = items[0];

      const newPO = await prisma.$transaction(async (tx) => {
        const poNumber = await nextSequenceTx(tx as any, "PO", 3);
        const created = await (tx as any).purchaseOrder.create({
          data: {
            poNumber,
            supplierId: String(supplierId),
            rawMaterialId: first.rawMaterialId,
            qty: first.qty,
            unitCost: first.unitCost,
            lines: {
              create: items.map((it, i) => ({
                rawMaterialId: it.rawMaterialId,
                lineNo: i + 1,
                qty: it.qty,
                unitCost: it.unitCost,
              })),
            },
            status: "ORDERED",
            expectedDate: expectedDate ? new Date(expectedDate as string) : null,
            createdBy: actorName,
            approvalStatus: approval.approvalStatus,
            approvalLevel: approval.approvalLevel,
          },
          include: {
            supplier: true,
            rawMaterial: true,
            lines: {
              include: {
                rawMaterial: { select: { id: true, sku: true, name: true, unit: true } },
              },
              orderBy: { lineNo: "asc" },
            },
          },
        });
        const what =
          items.length === 1
            ? `${byId.get(first.rawMaterialId)?.name} (${first.qty} ${byId.get(first.rawMaterialId)?.unit || "units"} from ${supplier.name})`
            : `${items.length} line items from ${supplier.name} (₹${total.toLocaleString("en-IN")})`;
        await (tx as any).auditLog.create({
          data: {
            actor: actorName,
            action: "PO_CREATED",
            entityType: "PURCHASE_ORDER",
            entityId: created.id,
            details: `Created ${poNumber} for ${what} → ${approval.approvalStatus}${approval.approvalStatus !== "APPROVED" ? " (needs " + approval.approvalLevel + " approval)" : ""}`,
          },
        });
        return created;
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
        include: { supplier: true, rawMaterial: true, lines: true },
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
        include: { supplier: true, rawMaterial: true, lines: true },
      });

        await logAudit({
          actor,
          action: "PO_APPROVED",
          entityType: "PURCHASE_ORDER",
          entityId: po.id,
          details: `Approved ${po.poNumber} (${po.approvalStatus} → APPROVED, ₹${poOrderedValue(po).toLocaleString("en-IN")}) by ${po.approvalStatus === "PENDING_OWNER" ? "owner" : "manager"}. Reason: ${reason}`,
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
        details: `Rejected ${po.poNumber} (₹${poOrderedValue(po).toLocaleString("en-IN")}). Reason: ${reason}`,
      });

      return NextResponse.json({ success: true, purchaseOrder: rejectedPO });
    }

    if (action === "RECEIVE_PO") {
      const { poId, receiveQty, batchNo, poLineId } = body;

      if (!poId || receiveQty == null || parseFloat(receiveQty) <= 0) {
        return NextResponse.json(
          { error: "Invalid receive quantity" },
          { status: 400 },
        );
      }

      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { supplier: true, rawMaterial: true, lines: true },
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

      const addQty = Number(receiveQty);
      if (!Number.isFinite(addQty) || addQty <= 0) {
        return NextResponse.json({ error: "receiveQty must be positive" }, { status: 400 });
      }

      const updatedPO = await prisma.$transaction(async (tx) => {
        const freshPo: any = await (tx as any).purchaseOrder.findUnique({
          where: { id: poId },
          include: { lines: { orderBy: { lineNo: "asc" } } },
        });
        if (!freshPo) throw new Error("PO not found");
        if (freshPo.status === "CANCELLED" || freshPo.status === "RECEIVED") {
          throw Object.assign(new Error(`Cannot receive items for PO in status ${freshPo.status}`), { code: "BAD_STATUS" });
        }
        if (freshPo.approvalStatus !== "APPROVED") {
          throw Object.assign(new Error(`PO_PENDING_APPROVAL: ${freshPo.poNumber} cannot be received — approval status is ${freshPo.approvalStatus}`), { code: "PENDING_APPROVAL" });
        }

        // Resolve the target line. POs created before multi-line support have no
        // line rows — synthesize one from the header mirror so legacy receipts
        // accumulate identically to before.
        let lines = freshPo.lines || [];
        if (lines.length === 0) {
          const synthesized: any = await (tx as any).purchaseOrderLine.create({
            data: {
              poId: freshPo.id,
              rawMaterialId: freshPo.rawMaterialId,
              lineNo: 1,
              qty: freshPo.qty,
              unitCost: freshPo.unitCost,
            },
          });
          lines = [synthesized];
        }
        let line: any;
        if (lines.length > 1) {
          if (!poLineId) {
            throw Object.assign(new Error("This PO has multiple lines — choose which line is being received"), { code: "LINE_REQUIRED" });
          }
          line = lines.find((l: any) => l.id === poLineId);
          if (!line) throw Object.assign(new Error("PO line not found"), { code: "LINE_NOT_FOUND" });
        } else {
          line = lines[0];
        }

        const newLineReceived = Number(line.receivedQty || 0) + addQty;
        await (tx as any).purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQty: newLineReceived },
        });

        const allLines = await (tx as any).purchaseOrderLine.findMany({
          where: { poId: freshPo.id },
        });
        const newReceivedQty = allLines.reduce((s: number, l: any) => s + Number(l.receivedQty || 0), 0);
        const isFullyReceived = allLines.every((l: any) => Number(l.receivedQty || 0) >= Number(l.qty) - 0.001);
        const newStatus = isFullyReceived ? "RECEIVED" : "PARTIAL";
        const now = new Date();
        const updated = await (tx as any).purchaseOrder.update({
          where: { id: poId },
          data: {
            receivedQty: newReceivedQty,
            status: newStatus,
            receivedAt: isFullyReceived ? freshPo.receivedAt || now : freshPo.receivedAt,
          },
          include: {
            supplier: true,
            rawMaterial: true,
            lines: {
              include: {
                rawMaterial: { select: { id: true, sku: true, name: true, unit: true } },
              },
              orderBy: { lineNo: "asc" },
            },
          },
        });
        await (tx as any).inventoryTransaction.create({
          data: {
            rawMaterialId: line.rawMaterialId,
            type: "IN",
            qty: addQty,
            unitCost: line.unitCost,
            batchNo: batchNo || `BATCH-PO-${freshPo.poNumber}`,
            reference: freshPo.poNumber,
            actorName,
            at: now,
          },
        });
        await (tx as any).rawMaterial.update({ where: { id: line.rawMaterialId }, data: { currentStock: { increment: addQty } } });
        await (tx as any).auditLog.create({
          data: {
            actor: actorName,
            action: "PO_RECEIVED",
            entityType: "PURCHASE_ORDER",
            entityId: freshPo.id,
            details: `Received ${addQty} units for ${freshPo.poNumber} (line ${line.lineNo}${line.rawMaterialId ? ", material " + line.rawMaterialId : ""}, batch ${batchNo || "N/A"}). PO status: ${newStatus}`,
          },
        });
        return updated;
      }).catch((e: any) => {
        if (e?.code === "BAD_STATUS" || e?.code === "PENDING_APPROVAL" || e?.code === "LINE_REQUIRED" || e?.code === "LINE_NOT_FOUND") throw e;
        throw e;
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
  } catch (error: any) {
    if (
      error?.code === "BAD_STATUS" ||
      error?.code === "PENDING_APPROVAL" ||
      error?.code === "LINE_REQUIRED" ||
      error?.code === "LINE_NOT_FOUND"
    ) {
      return NextResponse.json({ error: error?.message || "Bad request" }, { status: 400 });
    }
    console.error("Purchasing API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
