import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { numberToIndianWords } from "@/lib/invoicingEngine";

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

    const totalWords = numberToIndianWords(invoice.totalValue);

    return NextResponse.json({ invoice, totalWords });
  } catch (error: any) {
    console.error("GET /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice", details: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    const updated = await (prisma as any).invoice.update({
      where: { id },
      data: updateData,
      include: {
        dispatchRecord: true,
        workOrder: { include: { product: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor: "Admin",
        action: "UPDATED_INVOICE",
        entityType: "Invoice",
        entityId: id,
        details: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ invoice: updated });
  } catch (error: any) {
    console.error("PATCH /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update invoice", details: error.message },
      { status: 500 },
    );
  }
}
