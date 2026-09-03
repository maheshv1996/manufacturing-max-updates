import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { computeSalesLineTotals, round2 } from "@/lib/salesOrders";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const WRITE_GATE = ["commercial.edit", "ops.edit", "system.edit"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !canAny(user, ["commercial.view", "finance.view", "ops.view", "system.view"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("GET /api/commercial/sales-orders/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["confirm", "cancel", "update-lines"]),
  reason: z.string().max(500).optional().nullable(),
  expectedDelivery: z.string().optional().nullable(),
  poReference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).optional(),
        productName: z.string().min(1).max(300),
        quantity: z.coerce.number().positive().max(1_000_000),
        unitPrice: z.coerce.number().nonnegative().max(100_000_000),
        discountPct: z.coerce.number().min(0).max(100).optional().default(0),
        taxPct: z.coerce.number().min(0).max(100).optional().default(0),
      }),
    )
    .optional(),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !canAny(user, WRITE_GATE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(actionSchema, body);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    if (d.action === "confirm") {
      if (order.status !== "DRAFT") {
        return NextResponse.json(
          { error: `Order is ${order.status} — only DRAFT orders can be confirmed` },
          { status: 400 },
        );
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          ...(d.expectedDelivery ? { expectedDelivery: new Date(d.expectedDelivery) } : {}),
          ...(d.poReference !== undefined ? { poReference: d.poReference || null } : {}),
        },
        include: { lines: true },
      });
      await logAudit({
        actor,
        action: "SALES_ORDER_CONFIRMED",
        entityType: "SalesOrder",
        entityId: id,
        details: `${order.orderNumber} confirmed — ${order.grandTotal.toFixed(2)} ${order.currency}`,
      });
      return NextResponse.json({ success: true, order: updated });
    }

    if (d.action === "cancel") {
      if (order.status === "INVOICED" || order.status === "CANCELLED") {
        return NextResponse.json(
          { error: `Order is ${order.status} — cannot cancel` },
          { status: 400 },
        );
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "CANCELLED", notes: d.reason ? `${order.notes ? order.notes + " — " : ""}CANCELLED: ${d.reason}` : order.notes },
      });
      await logAudit({
        actor,
        action: "SALES_ORDER_CANCELLED",
        entityType: "SalesOrder",
        entityId: id,
        details: `${order.orderNumber} cancelled${d.reason ? " — " + d.reason.slice(0, 120) : ""}`,
        severity: "WARN",
      });
      return NextResponse.json({ success: true, order: updated });
    }

    // update-lines — only on DRAFT orders
    if (order.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Order is ${order.status} — lines can only be revised while DRAFT` },
        { status: 400 },
      );
    }
    if (!d.lines || d.lines.length === 0) {
      return NextResponse.json({ error: "lines required for update-lines" }, { status: 400 });
    }
    let totalValue = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;
    const lineRows = d.lines.map((l) => {
      const t = computeSalesLineTotals(l);
      totalValue += t.amount;
      totalDiscount += t.discountAmt;
      totalTax += t.taxAmt;
      grandTotal += t.total;
      return {
        productId: l.productId || null,
        productName: l.productName,
        quantity: Number(l.quantity),
        unitPrice: round2(Number(l.unitPrice)),
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        amount: t.amount,
        discountAmt: t.discountAmt,
        taxAmt: t.taxAmt,
        total: t.total,
      };
    });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
      return tx.salesOrder.update({
        where: { id },
        data: {
          totalValue: round2(totalValue),
          totalDiscount: round2(totalDiscount),
          totalTax: round2(totalTax),
          grandTotal: round2(grandTotal),
          lines: { create: lineRows },
        },
        include: { lines: true },
      });
    });
    await logAudit({
      actor,
      action: "SALES_ORDER_LINES_UPDATED",
      entityType: "SalesOrder",
      entityId: id,
      details: `${order.orderNumber} lines revised — ${updated.lines.length} line(s), ${updated.grandTotal.toFixed(2)} ${order.currency}`,
      severity: "WARN",
    });
    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error("POST /api/commercial/sales-orders/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}