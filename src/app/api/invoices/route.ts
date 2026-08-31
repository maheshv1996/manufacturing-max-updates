import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, calculateTax } from "@/lib/invoicingEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const invoices = await (prisma as any).invoice.findMany({
      include: {
        dispatchRecord: {
          select: {
            id: true,
            challanNumber: true,
            dispatchedQty: true,
            dispatchedAt: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            woNumber: true,
            quotedPrice: true,
            plannedQuantity: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                sellingPricePerUnit: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "INVOICE_CREATED", entityType: "Invoice", details: "Invoice created" });
  try {
    const body = await req.json();
    const {
      dispatchRecordId,
      workOrderId,
      customerName,
      customerAddress,
      customerGstin,
      taxType = "INTRA",
      taxRatePct = 18,
      dueDate,
      notes,
    } = body;

    if (!dispatchRecordId && !workOrderId) {
      return NextResponse.json(
        { error: "dispatchRecordId or workOrderId is required" },
        { status: 400 },
      );
    }

    let dispatchRecord: any = null;
    let workOrder: any = null;

    if (dispatchRecordId) {
      // Check if invoice already exists for this dispatch (UNIQUE CONSTRAIN RULE!)
      const existing = await (prisma as any).invoice.findUnique({
        where: { dispatchRecordId },
      });

      if (existing) {
        return NextResponse.json(
          {
            error: `An invoice (${existing.invoiceNumber}) already exists for this dispatch.`,
          },
          { status: 400 },
        );
      }

      dispatchRecord = await (prisma as any).dispatchRecord.findUnique({
        where: { id: dispatchRecordId },
        include: {
          workOrder: {
            include: { product: true },
          },
        },
      });

      if (!dispatchRecord) {
        return NextResponse.json(
          { error: "Dispatch record not found" },
          { status: 404 },
        );
      }

      workOrder = dispatchRecord.workOrder;
    } else if (workOrderId) {
      workOrder = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: { product: true },
      });
    }

    if (!workOrder) {
      return NextResponse.json(
        { error: "Work Order not found" },
        { status: 404 },
      );
    }

    // M29 — milestone doc-pack gate joins invoicing: a WO under a project with
    // milestones cannot be invoiced until every milestone is COMPLETED (which
    // itself requires its full doc pack delivered).
    if (workOrder.projectId) {
      const openMilestones = await (prisma as any).projectMilestone.count({
        where: { projectId: workOrder.projectId, status: { not: "COMPLETED" } },
      });
      if (openMilestones > 0) {
        return NextResponse.json(
          {
            error: `Milestone gate: ${openMilestones} milestone(s) on this project are not COMPLETED — complete milestones (and their doc packs) before invoicing.`,
          },
          { status: 400 },
        );
      }
    }

    // Determine unit price: WO quotedPrice / plannedQuantity, fallback product.sellingPricePerUnit or 100
    const qty = dispatchRecord
      ? dispatchRecord.dispatchedQty
      : workOrder.plannedQuantity;
    let unitPrice = 0;
    if (workOrder.quotedPrice && workOrder.plannedQuantity > 0) {
      unitPrice = workOrder.quotedPrice / workOrder.plannedQuantity;
    } else if (workOrder.product?.sellingPricePerUnit) {
      unitPrice = workOrder.product.sellingPricePerUnit;
    } else {
      unitPrice = 100.0;
    }

    const taxableValue = Number((qty * unitPrice).toFixed(2));
    const taxCalc = calculateTax(taxableValue, taxType, taxRatePct);
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await (prisma as any).invoice.create({
      data: {
        invoiceNumber,
        dispatchRecordId: dispatchRecordId || null,
        workOrderId: workOrder.id,
        customerName:
          customerName || workOrder.customerName || "Valued Customer",
        customerAddress: customerAddress || null,
        customerGstin: customerGstin || null,
        invoiceDate: new Date(),
        taxableValue: taxCalc.taxableValue,
        taxType: taxCalc.taxType,
        taxRatePct: taxCalc.taxRatePct,
        cgstAmt: taxCalc.cgstAmt,
        sgstAmt: taxCalc.sgstAmt,
        igstAmt: taxCalc.igstAmt,
        totalValue: taxCalc.totalValue,
        dueDate: dueDate
          ? new Date(dueDate)
          : new Date(Date.now() + 30 * 86400000),
        status: "UNPAID",
        notes: notes || null,
      },
      include: {
        dispatchRecord: true,
        workOrder: { include: { product: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor: "Admin",
        action: "CREATED_INVOICE",
        entityType: "Invoice",
        entityId: invoice.id,
        details: JSON.stringify({
          invoiceNumber,
          customerName: invoice.customerName,
          totalValue: invoice.totalValue,
        }),
      },
    });

    return NextResponse.json({ invoice, taxCalc }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/invoices error:", error);
    return NextResponse.json(
      { error: "Failed to create invoice", details: error.message },
      { status: 500 },
    );
  }
}
