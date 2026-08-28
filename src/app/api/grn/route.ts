import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const MATCH_TOLERANCE_PCT = 0.5; // 0.5% value tolerance

// Compute the 3-way match status for a GRN against its PO and supplier invoice.
function computeMatch(
  grn: { receivedQty: number },
  po: { qty: number; unitCost: number },
  invoice?: { amount: number; taxAmount: number; totalAmount: number } | null,
) {
  if (!invoice) return "UNMATCHED";
  const expectedQty = po.qty;
  const expectedValue = po.qty * po.unitCost;
  // Short receipt (partial) still flagged unless fully received
  const partial = grn.receivedQty < expectedQty - 0.001;
  const valueTolerance = expectedValue * (MATCH_TOLERANCE_PCT / 100);
  const valueOk = Math.abs(invoice.amount - expectedValue) <= valueTolerance;
  // Value disagreement is the harder control failure — flag it first
  if (!valueOk) return "MISMATCHED";
  if (partial) return "PARTIAL";
  return "MATCHED";
}

export async function GET() {
  try {
    const [grns, invoices, pos, suppliers, rawMaterials, aqlPlans] =
      await Promise.all([
        prisma.goodsReceiptNote.findMany({
          include: {
            po: true,
            supplier: { select: { id: true, name: true, code: true } },
            rawMaterial: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                materialClass: true,
              },
            },
            supplierInvoice: true,
          },
          orderBy: { receivedAt: "desc" },
        }),
        prisma.supplierInvoice.findMany({
          include: {
            supplier: { select: { name: true } },
            po: { select: { poNumber: true, qty: true, unitCost: true } },
            grn: { select: { grnNumber: true, receivedQty: true } },
          },
          orderBy: { invoiceDate: "desc" },
        }),
        prisma.purchaseOrder.findMany({
          where: { status: { not: "CANCELLED" } },
          include: {
            supplier: { select: { id: true, name: true } },
            rawMaterial: {
              select: { id: true, sku: true, name: true, unit: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.supplier.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.rawMaterial.findMany({
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            materialClass: true,
          },
          orderBy: { sku: "asc" },
        }),
        prisma.aqlPlan.findMany({ orderBy: { materialClass: "asc" } }),
      ]);

    const enriched = grns.map((g) => ({
      ...g,
      matchStatus: computeMatch(g, g.po, g.supplierInvoice || null),
    }));

    // Live invoice status vs match
    const now = Date.now();
    const enrichedInvoices = invoices.map((inv) => {
      const matchStatus = inv.grn
        ? computeMatch(inv.grn, inv.po || { qty: 0, unitCost: 0 }, inv)
        : "UNMATCHED";
      // Aging: days since invoice date (for unpaid/mismatched) and days overdue (past dueDate)
      const daysSinceInvoice = Math.max(
        0,
        Math.floor((now - new Date(inv.invoiceDate).getTime()) / 86400000),
      );
      const daysOverdue = inv.dueDate
        ? Math.max(
            0,
            Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000),
          )
        : 0;
      let bucket = "current";
      if (inv.status === "PAID") bucket = "paid";
      else if (daysOverdue > 0) bucket = "overdue";
      else if (daysSinceInvoice > 60) bucket = "60plus";
      else if (daysSinceInvoice > 30) bucket = "30to60";
      else if (daysSinceInvoice > 0) bucket = "1to30";
      return {
        ...inv,
        matchStatus,
        aging: { daysSinceInvoice, daysOverdue, bucket },
      };
    });

    // Cash-flow forecast: outstanding matched/unpaid amounts bucketed by 30-day windows from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets30: { label: string; amount: number }[] = [
      { label: "0–30 days", amount: 0 },
      { label: "31–60 days", amount: 0 },
      { label: "61–90 days", amount: 0 },
      { label: "90+ days", amount: 0 },
      { label: "Overdue", amount: 0 },
    ];
    let outstandingTotal = 0;
    let overdueTotal = 0;
    for (const inv of enrichedInvoices) {
      if (inv.status === "PAID") continue;
      const total = inv.totalAmount || inv.amount || 0;
      outstandingTotal += total;
      const days = inv.aging.daysOverdue;
      if (days > 0) {
        overdueTotal += total;
        buckets30[4].amount += total;
        continue;
      }
      const dueIn = inv.dueDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(inv.dueDate).getTime() - today.getTime()) / 86400000,
            ),
          )
        : inv.aging.daysSinceInvoice;
      if (dueIn <= 30) buckets30[0].amount += total;
      else if (dueIn <= 60) buckets30[1].amount += total;
      else if (dueIn <= 90) buckets30[2].amount += total;
      else buckets30[3].amount += total;
    }

    return NextResponse.json({
      grns: enriched,
      invoices: enrichedInvoices,
      pos,
      suppliers,
      rawMaterials,
      aqlPlans: aqlPlans || [],
      cashflow: { buckets30, outstandingTotal, overdueTotal },
    });
  } catch (error: any) {
    console.error("GET /api/grn error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GRN data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const headerList = await headers();
    const userName = headerList.get("x-user-name") || "System";

    // ---- Goods Receipt Note: receives stock, updates PO + inventory ----
    if (body.entity === "grn") {
      const { poId, receivedQty, batchNo, notes } = body.data || {};
      if (!poId || !receivedQty)
        return NextResponse.json(
          { error: "poId and receivedQty required" },
          { status: 400 },
        );
      const qty = Number(receivedQty);
      if (qty <= 0)
        return NextResponse.json(
          { error: "receivedQty must be positive" },
          { status: 400 },
        );

      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { rawMaterial: true, supplier: true },
      });
      if (!po)
        return NextResponse.json({ error: "PO not found" }, { status: 404 });

      const count = await prisma.goodsReceiptNote.count();
      const grnNumber = `GRN-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;

      // Create GRN
      const grn = await prisma.goodsReceiptNote.create({
        data: {
          grnNumber,
          poId: po.id,
          supplierId: po.supplierId,
          rawMaterialId: po.rawMaterialId,
          receivedQty: qty,
          receivedBy: userName,
          batchNo: batchNo || null,
          notes: notes || null,
        },
      });

      // Post stock IN
      await prisma.rawMaterial.update({
        where: { id: po.rawMaterialId },
        data: { currentStock: { increment: qty } },
      });
      await prisma.inventoryTransaction.create({
        data: {
          rawMaterialId: po.rawMaterialId,
          type: "IN",
          qty,
          unitCost: po.unitCost,
          batchNo: batchNo || null,
          reference: grnNumber,
          actorName: userName,
        },
      });

      // Update PO received qty/status
      const newReceived = po.receivedQty + qty;
      const poStatus = newReceived >= po.qty - 0.001 ? "RECEIVED" : "PARTIAL";
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          receivedQty: newReceived,
          receivedAt: new Date(),
          status: poStatus,
        },
      });

      await logAudit({
        actor: userName,
        action: "GRN_CREATED",
        entityType: "GRN",
        entityId: grn.id,
        details: `GRN ${grnNumber}: received ${qty} ${po.rawMaterial.unit} of ${po.rawMaterial.name} against ${po.poNumber}`,
      });

      return NextResponse.json({ success: true, item: grn });
    }

    // ---- Supplier Invoice: creates invoice, runs 3-way match ----
    if (body.entity === "invoice") {
      const {
        supplierId,
        poId,
        invoiceNumber,
        amount,
        taxAmount,
        invoiceDate,
        dueDate,
        notes,
      } = body.data || {};
      if (!supplierId || !invoiceNumber || amount === undefined) {
        return NextResponse.json(
          { error: "supplierId, invoiceNumber, amount required" },
          { status: 400 },
        );
      }
      const netAmount = Number(amount);
      const tax = taxAmount ? Number(taxAmount) : 0;
      const inv = await prisma.supplierInvoice.create({
        data: {
          invoiceNumber,
          supplierId,
          poId: poId || null,
          amount: netAmount,
          taxAmount: tax,
          totalAmount: netAmount + tax,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes || null,
        },
      });

      // Link to the latest GRN for the PO (if any) and run 3-way match
      let matchStatus = "UNMATCHED";
      if (poId) {
        const grn = await prisma.goodsReceiptNote.findFirst({
          where: { poId, supplierInvoice: { is: null } },
          orderBy: { receivedAt: "desc" },
        });
        if (grn) {
          const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
          });
          await prisma.supplierInvoice.update({
            where: { id: inv.id },
            data: { grnId: grn.id },
          });
          matchStatus = po
            ? computeMatch(grn, po, {
                amount: netAmount,
                taxAmount: tax,
                totalAmount: netAmount + tax,
              })
            : "UNMATCHED";
          await prisma.goodsReceiptNote.update({
            where: { id: grn.id },
            data: { matchStatus: matchStatus as any },
          });
        }
      }
      const finalInv = await prisma.supplierInvoice.update({
        where: { id: inv.id },
        data: {
          status:
            matchStatus === "MATCHED"
              ? "MATCHED"
              : matchStatus === "MISMATCHED"
                ? "MISMATCHED"
                : "UNPAID",
        },
      });

      await logAudit({
        actor: userName,
        action: "SUPPLIER_INVOICE_CREATED",
        entityType: "SUPPLIER_INVOICE",
        entityId: inv.id,
        details: `Invoice ${invoiceNumber} (${netAmount + tax}) — 3-way match: ${matchStatus}`,
      });

      return NextResponse.json({ success: true, item: finalInv });
    }

    // ---- Inspection decision on a GRN (M6 — IQC AQL) ----
    if (body.entity === "inspect") {
      const { id, inspectionStatus, inspector, notes } = body.data || {};
      if (!["PASSED", "REJECTED"].includes(inspectionStatus)) {
        return NextResponse.json(
          { error: "inspectionStatus must be PASSED or REJECTED" },
          { status: 400 },
        );
      }
      const existing = await prisma.goodsReceiptNote.findUnique({
        where: { id },
        include: {
          rawMaterial: {
            select: { sku: true, name: true, materialClass: true },
          },
          supplier: { select: { name: true } },
        },
      });
      if (!existing)
        return NextResponse.json({ error: "GRN not found" }, { status: 404 });

      // AQL sample size per material class
      const aql = await prisma.aqlPlan.findUnique({
        where: { materialClass: existing.rawMaterial.materialClass || "C" },
      });
      const aqlSampleSize = aql?.sampleSize ?? null;

      let lotHeld = existing.lotHeld;
      let ncrId = existing.ncrId;
      if (inspectionStatus === "REJECTED") {
        lotHeld = true; // M6 — IQC fail auto-holds the lot
        if (!ncrId) {
          // Auto supplier NCR draft
          const year = new Date().getFullYear();
          const ncrCount = await prisma.ncrReport.count({
            where: { ncrNumber: { startsWith: `NCR-SUP-${year}-` } },
          });
          const ncrNumber = `NCR-SUP-${year}-${String(ncrCount + 1).padStart(3, "0")}`;
          const ncr = await prisma.ncrReport.create({
            data: {
              ncrNumber,
              supplierId: existing.supplierId,
              grnId: existing.id,
              quantity: existing.receivedQty,
              severity: "HIGH",
              description: `IQC AQL rejection — GRN ${existing.grnNumber} (batch ${existing.batchNo || "—"}, ${existing.rawMaterial.sku}) failed incoming inspection. AQL class ${existing.rawMaterial.materialClass || "C"}, sample ${aqlSampleSize ?? "?"} pcs. Lot HELD pending supplier disposition.`,
              status: "OPEN",
              raisedBy: inspector || userName,
              raisedAt: new Date(),
            },
          });
          ncrId = ncr.id;
          await logAudit({
            actor: inspector || userName,
            action: "NCR_RAISED",
            entityType: "NCR",
            entityId: ncr.id,
            details: `Auto-raised supplier NCR ${ncrNumber} from IQC rejection of GRN ${existing.grnNumber}`,
          });
        }
      }

      const grn = await prisma.goodsReceiptNote.update({
        where: { id },
        data: {
          inspectionStatus,
          lotHeld,
          aqlSampleSize,
          ncrId,
          inspector: inspector || userName,
          inspectedAt: new Date(),
          notes: notes || undefined,
        },
      });
      await logAudit({
        actor: userName,
        action: "GRN_INSPECTED",
        entityType: "GRN",
        entityId: grn.id,
        details: `GRN ${grn.grnNumber} — ${inspectionStatus}${lotHeld ? " · LOT HELD + supplier NCR draft" : ""} (AQL ${aqlSampleSize ?? "n/a"} pcs)`,
      });
      return NextResponse.json({
        success: true,
        item: { ...grn, aqlSampleSize, lotHeld, ncrId },
      });
    }

    // ---- M6 — AQL plan upsert (sampling table per material class) ----
    if (body.entity === "aql-plan") {
      const {
        materialClass,
        aqlLevel,
        sampleSize,
        acceptanceNumber,
        rejectionNumber,
        description,
      } = body.data || {};
      if (!materialClass || !["A", "B", "C"].includes(materialClass)) {
        return NextResponse.json(
          { error: "materialClass must be A, B or C" },
          { status: 400 },
        );
      }
      const sample = Number(sampleSize);
      const ac = Number(acceptanceNumber);
      const re = Number(rejectionNumber);
      if (!sample || sample <= 0 || ac == null || re == null || re <= ac) {
        return NextResponse.json(
          {
            error:
              "valid sampleSize and rejectionNumber > acceptanceNumber required",
          },
          { status: 400 },
        );
      }
      const plan = await prisma.aqlPlan.upsert({
        where: { materialClass },
        update: {
          aqlLevel: aqlLevel || "II",
          sampleSize: sample,
          acceptanceNumber: ac,
          rejectionNumber: re,
          description: description || null,
        },
        create: {
          materialClass,
          aqlLevel: aqlLevel || "II",
          sampleSize: sample,
          acceptanceNumber: ac,
          rejectionNumber: re,
          description: description || null,
        },
      });
      await logAudit({
        actor: userName,
        action: "AQL_PLAN_UPDATED",
        entityType: "AQL_PLAN",
        entityId: plan.id,
        details: `AQL class ${materialClass} — sample ${sample}, Ac ${ac}/Re ${re}`,
      });
      return NextResponse.json({ success: true, item: plan });
    }

    // ---- Payment against a matched supplier invoice ----
    if (body.entity === "pay") {
      const { id, amount, method, reference } = body.data || {};
      const inv = await prisma.supplierInvoice.findUnique({ where: { id } });
      if (!inv)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      // 3-way gate: only MATCHED invoices can be paid
      const po = inv.poId
        ? await prisma.purchaseOrder.findUnique({ where: { id: inv.poId } })
        : null;
      const grn = inv.grnId
        ? await prisma.goodsReceiptNote.findUnique({ where: { id: inv.grnId } })
        : null;
      const match = computeMatch(
        grn || { receivedQty: 0 },
        po || { qty: 0, unitCost: 0 },
        inv,
      );
      if (match !== "MATCHED") {
        return NextResponse.json(
          {
            error: `Payment blocked — 3-way match is ${match}. PO, GRN and invoice must agree before payment.`,
            code: "THREE_WAY_BLOCKED",
            matchStatus: match,
          },
          { status: 403 },
        );
      }
      const payAmount = amount ? Number(amount) : inv.totalAmount;
      const updated = await prisma.supplierInvoice.update({
        where: { id },
        data: {
          status: "PAID",
          notes: reference
            ? `${inv.notes || ""} Ref: ${reference}`.trim()
            : inv.notes,
        },
      });
      // Mirror into treasury ledger
      await prisma.treasuryTransaction.create({
        data: {
          type: "OUTFLOW",
          account: "Main",
          amount: payAmount,
          reference: inv.invoiceNumber,
          category: "Supplier Payment",
          notes: `Paid ${inv.invoiceNumber} (3-way matched) via ${method || "Bank"}`,
        },
      });
      await logAudit({
        actor: userName,
        action: "SUPPLIER_PAYMENT",
        entityType: "SUPPLIER_INVOICE",
        entityId: inv.id,
        details: `Paid ${inv.invoiceNumber} ${payAmount} (3-way matched)`,
      });
      return NextResponse.json({ success: true, item: updated });
    }

    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/grn error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save" },
      { status: 500 },
    );
  }
}
