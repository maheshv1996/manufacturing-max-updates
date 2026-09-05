import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import {
  computeSalesLineTotals,
  round2,
  nextSalesOrderNumber,
} from "@/lib/salesOrders";
import { logAuditTx } from "@/lib/audit";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const WRITE_GATE = ["commercial.edit", "ops.edit", "system.edit"];

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["commercial.view", "finance.view", "ops.view", "system.view"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [orders, byStatus] = await Promise.all([
      prisma.salesOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          customer: { select: { code: true, name: true, currency: true } },
          lines: true,
        },
      }),
      prisma.salesOrder.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
    ]);

    const statusOf = (s: string) => byStatus.find((b) => b.status === s);
    return NextResponse.json({
      success: true,
      orders,
      stats: {
        total: orders.length,
        open: (statusOf("CONFIRMED")?._count._all || 0) + (statusOf("IN_PRODUCTION")?._count._all || 0),
        invoiced: statusOf("INVOICED")?._count._all || 0,
        bookedValue: Math.round(statusOf("CONFIRMED")?._sum.grandTotal || 0),
      },
    });
  } catch (error) {
    console.error("GET /api/commercial/sales-orders error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const salesLineSchema = z.object({
  productId: z.string().min(1).optional(),
  productCode: z.string().max(80).optional().nullable(),
  productName: z.string().min(1).max(300).optional(),
  description: z.string().max(500).optional().nullable(),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitPrice: z.coerce.number().nonnegative().max(100_000_000),
  discountPct: z.coerce.number().min(0).max(100).optional().default(0),
  taxPct: z.coerce.number().min(0).max(100).optional().default(0),
  scheduledDate: z.string().optional().nullable(),
});

const createSalesOrderSchema = z
  .object({
    customerId: z.string().min(1),
    quotationId: z.string().min(1).optional(),
    orderDate: z.string().optional(),
    expectedDelivery: z.string().optional().nullable(),
    poReference: z.string().max(100).optional().nullable(),
    paymentTerms: z.string().max(40).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    lines: z.array(salesLineSchema).min(1).max(100).optional(),
    clientId: z.string().max(200).optional().nullable(),
  })
  .refine((d) => d.quotationId || (d.lines && d.lines.length > 0), {
    message: "Provide lines or a quotationId to build the order from",
  });

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, WRITE_GATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const parsed = parseOr400(createSalesOrderSchema, body);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const clientId = d.clientId ? String(d.clientId).trim() : null;
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
      }
    }

    const customer = await prisma.customer.findUnique({ where: { id: d.customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (!customer.isActive) {
      return NextResponse.json({ error: `Customer ${customer.name} is inactive — activate before booking orders` }, { status: 400 });
    }

    // Resolve lines: explicit lines win; otherwise clone from the quotation.
    interface LinePlan {
      productId: string | null;
      productCode: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      discountPct: number;
      taxPct: number;
      scheduledDate: Date | null;
    }
    let linePlans: LinePlan[] = [];
    if (d.lines && d.lines.length > 0) {
      for (const l of d.lines) {
        linePlans.push({
          productId: l.productId || null,
          productCode: l.productCode || null,
          productName: l.productName || l.description || "Line item",
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountPct: Number(l.discountPct || 0),
          taxPct: Number(l.taxPct || 0),
          scheduledDate: l.scheduledDate ? new Date(l.scheduledDate) : null,
        });
      }
    } else if (d.quotationId) {
      const quote = await prisma.quotation.findUnique({
        where: { id: d.quotationId },
        include: { lines: { include: { product: true } } },
      });
      if (!quote) {
        return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
      }
      for (const ql of quote.lines) {
        linePlans.push({
          productId: ql.productId,
          productCode: (ql.product as any)?.sku || null,
          productName: (ql.product as any)?.name || `Product ${ql.productId}`,
          quantity: ql.plannedQty,
          unitPrice: ql.unitPrice,
          discountPct: Number((quote as any).discountPct || 0),
          taxPct: 0,
          scheduledDate: null,
        });
      }
      if (linePlans.length === 0) {
        return NextResponse.json({ error: "Quotation has no lines to copy" }, { status: 400 });
      }
    }

    const orderDate = d.orderDate ? new Date(d.orderDate) : new Date();
    const expectedDelivery = d.expectedDelivery ? new Date(d.expectedDelivery) : null;

    const order = await prisma.$transaction(async (tx) => {
      if (clientId) {
        const reserved = await reserveIdempotency(tx as any, clientId, "/api/commercial/sales-orders");
        if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
      }
      const orderNumber = await nextSalesOrderNumber(tx as any, orderDate);

      let totalValue = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let grandTotal = 0;
      const lineRows = linePlans.map((lp) => {
        const t = computeSalesLineTotals(lp);
        totalValue += t.amount;
        totalDiscount += t.discountAmt;
        totalTax += t.taxAmt;
        grandTotal += t.total;
        return {
          productId: lp.productId,
          productCode: lp.productCode,
          productName: lp.productName,
          quantity: lp.quantity,
          unitPrice: round2(lp.unitPrice),
          discountPct: lp.discountPct,
          taxPct: lp.taxPct,
          amount: t.amount,
          discountAmt: t.discountAmt,
          taxAmt: t.taxAmt,
          total: t.total,
          scheduledDate: lp.scheduledDate,
        };
      });

      const createdOrder = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerName: customer.name,
          orderDate,
          expectedDelivery,
          poReference: d.poReference || null,
          paymentTerms: d.paymentTerms || customer.paymentTerms || "NET30",
          currency: customer.currency || "INR",
          status: "DRAFT",
          sourceQuotationId: d.quotationId || null,
          totalValue: round2(totalValue),
          totalDiscount: round2(totalDiscount),
          totalTax: round2(totalTax),
          grandTotal: round2(grandTotal),
          notes: d.notes || null,
          createdBy: actor,
          lines: { create: lineRows },
        },
        include: { lines: true },
      });

      await logAuditTx(tx, {
        actor,
        action: "SALES_ORDER_CREATED",
        entityType: "SalesOrder",
        entityId: createdOrder.id,
        details: `${createdOrder.orderNumber} for ${customer.name} — ${createdOrder.lines.length} line(s), ${createdOrder.grandTotal.toFixed(2)} ${createdOrder.currency}${d.quotationId ? " (from quotation)" : ""}`,
      });

      return createdOrder;
    });

    const payload = { success: true, order };
    if (clientId) await completeIdempotency(clientId, payload);

    return NextResponse.json(payload);
  } catch (error: any) {
    if (error?.code === "DUPLICATE") {
      return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
    }
    console.error("POST /api/commercial/sales-orders error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}