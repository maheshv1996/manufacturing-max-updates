import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const userName = headersList.get("x-user-name") || "System";

    if (
      !user.isOwner &&
      !can(user, "system.edit") &&
      !user.isOwner &&
      !can(user, "ops.edit")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amount, method, paymentDate, reference, notes } = body;

    if (!amount || amount <= 0 || !method) {
      return NextResponse.json(
        { error: "Valid amount and method are required" },
        { status: 400 },
      );
    }

    const invoice = await (prisma as any).invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const newPaidAmount = invoice.paidAmount + amount;

    let newStatus = invoice.status;
    if (newPaidAmount >= invoice.totalValue) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount,
          method,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          reference,
          notes,
          receivedBy: userName,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      await logAudit({
        action: "PAYMENT_RECORDED",
        entityType: "Invoice",
        entityId: id,
        details: `Recorded payment of ₹${amount} via ${method} against invoice ${invoice.invoiceNumber}. Status is now ${newStatus}.`,
        actor: userName,
      });

      return { payment, updatedInvoice };
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 },
    );
  }
}
