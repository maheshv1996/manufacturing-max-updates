import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { numberToIndianWords } from "@/lib/invoicingEngine";
import { fromPaiseRow, fromPaiseRows } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id },
      include: {
        dispatchRecord: {
          select: {
            id: true,
            challanNumber: true,
            dispatchedQty: true,
            dispatchedAt: true,
            carrierName: true,
            vehicleNumber: true,
          },
        },
        workOrder: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Ledger-style fixed point: row stores paise — expose the rupee contract.
    const invoiceRupees = {
      ...fromPaiseRow("Invoice", invoice),
      lines: Array.isArray(invoice.lines)
        ? fromPaiseRows("InvoiceLine", invoice.lines)
        : invoice.lines,
    };
    const totalWords = numberToIndianWords(invoiceRupees.totalValue);

    return NextResponse.json({ invoice: invoiceRupees, totalWords });
  } catch (error: any) {
    console.error("GET /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "commercial.edit") && !can(user, "system.edit"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      status,
      notes,
      customerName,
      customerAddress,
      customerGstin,
      dueDate,
    } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (customerName) updateData.customerName = customerName;
    if (customerAddress !== undefined)
      updateData.customerAddress = customerAddress;
    if (customerGstin !== undefined) updateData.customerGstin = customerGstin;
    if (dueDate !== undefined)
      updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await (tx as any).invoice.update({
        where: { id },
        data: updateData,
        include: {
          dispatchRecord: true,
          workOrder: { include: { product: true } },
        },
      });

      await logAuditTx(tx, {
        actor: user.name || "Admin",
        action: "UPDATED_INVOICE",
        entityType: "Invoice",
        entityId: id,
        details: JSON.stringify(updateData),
      });

      return inv;
    });

    return NextResponse.json({ invoice: updated });
  } catch (error: any) {
    console.error("PATCH /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 },
    );
  }
}
