import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { autoPostToGL } from "@/lib/glPosting";
import { toPaise, fromPaiseRow } from "@/lib/money";

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
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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

    // Invoice money is stored as integer paise; the request amount is rupees.
    const amountPaise = toPaise(Number(amount));
    const newPaidAmount = Number(invoice.paidAmount) + amountPaise;

    let newStatus = invoice.status;
    if (newPaidAmount >= Number(invoice.totalValue)) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: amountPaise,
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

    // GL auto-post: Dr Bank, Cr Accounts Receivable for the received amount
    const glInvoice = await (prisma as any).journalEntry.findFirst({
      where: { source: "INVOICE", sourceId: invoice.id },
      select: { id: true },
    });
    if (result?.payment?.id && Number(amount) > 0 && glInvoice) {
      await autoPostToGL({
        source: "PAYMENT",
        sourceId: result.payment.id,
        memo: `Customer payment ${Number(amount)} via ${method} — invoice ${invoice.invoiceNumber}`,
        createdBy: userName,
        date: paymentDate ? new Date(paymentDate) : undefined,
        lines: [
          {
            accountCode: "1020",
            debit: Number(amount),
            reference: invoice.invoiceNumber,
            narration: "Bank receipt",
          },
          {
            accountCode: "1030",
            credit: Number(amount),
            reference: invoice.invoiceNumber,
            narration: `Against ${invoice.invoiceNumber}`,
          },
        ],
      });
    }

    // Expose the rupee contract: payment + updated invoice amounts.
    const resultRupees = {
      payment: fromPaiseRow("Payment", result.payment),
      updatedInvoice: fromPaiseRow("Invoice", result.updatedInvoice),
    };
    return NextResponse.json({ success: true, result: resultRupees });
  } catch (error: any) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 },
    );
  }
}
