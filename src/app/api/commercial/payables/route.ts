import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const supplierId = url.searchParams.get("supplierId");

    // Payables Engine
    // For each supplier, purchasedValue = sum(qtyReceived * unitCost) of RECEIVED POs
    // paidValue = sum(payments)

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        include: {
          purchaseOrders: {
            where: { status: "RECEIVED" },
          },
          payments: {
            orderBy: { paymentDate: "desc" },
          },
        },
      });
      if (!supplier)
        return NextResponse.json({ error: "Not found" }, { status: 404 });

      const purchasedValue = supplier.purchaseOrders.reduce(
        (sum, po) => sum + po.receivedQty * po.unitCost,
        0,
      );
      const paidValue = supplier.payments.reduce((sum, p) => sum + p.amount, 0);
      const balancePayable = purchasedValue - paidValue;

      return NextResponse.json({
        purchasedValue,
        paidValue,
        balancePayable,
        payments: supplier.payments,
        purchaseOrders: supplier.purchaseOrders,
      });
    }

    // Aggregate for all suppliers
    const suppliers = await prisma.supplier.findMany({
      include: {
        purchaseOrders: {
          where: { status: "RECEIVED" },
        },
        payments: true,
      },
      orderBy: { name: "asc" },
    });

    let totalPayablesOutstanding = 0;

    const supplierBalances = suppliers.map((s) => {
      const purchasedValue = s.purchaseOrders.reduce(
        (sum, po) => sum + po.receivedQty * po.unitCost,
        0,
      );
      const paidValue = s.payments.reduce((sum, p) => sum + p.amount, 0);
      const balancePayable = purchasedValue - paidValue;

      // Only sum positive balances (where we owe them money)
      if (balancePayable > 0) {
        totalPayablesOutstanding += balancePayable;
      }

      return {
        id: s.id,
        name: s.name,
        code: s.code,
        purchasedValue,
        paidValue,
        balancePayable,
        lastPaymentDate:
          s.payments.length > 0
            ? s.payments.reduce(
                (latest, p) =>
                  p.paymentDate > latest ? p.paymentDate : latest,
                s.payments[0].paymentDate,
              )
            : null,
      };
    });

    return NextResponse.json({
      totalPayablesOutstanding,
      suppliers: supplierBalances,
    });
  } catch (error: any) {
    console.error("Payables fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user || (!user.isOwner && !can(user, "commercial.edit"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      supplierId,
      amount,
      method,
      reference,
      notes,
      purchaseOrderId,
      paymentDate,
    } = body;

    const payment = await prisma.supplierPayment.create({
      data: {
        supplierId,
        amount: parseFloat(amount),
        method,
        reference,
        notes,
        purchaseOrderId: purchaseOrderId || null,
        actorName: user.name,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "SUPPLIER_PAYMENT_RECORDED",
        actor: user.name,
        entityType: "SupplierPayment",
        entityId: payment.id,
        details: `Recorded ₹${amount} payment via ${method} to supplier ${supplierId}`,
      },
    });

    return NextResponse.json(payment);
  } catch (error: any) {
    console.error("Payables POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
