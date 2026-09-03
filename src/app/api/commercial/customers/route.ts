import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { fromPaise, toPaise, fromPaiseRow, fromPaiseRows } from "@/lib/money";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !canAny(user, ["commercial.view", "finance.view", "ops.view"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [customers, invoices, salesOrders] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { name: "asc" },
        take: 500,
        include: { contacts: { orderBy: { isPrimary: "desc" } } },
      }),
      prisma.invoice.findMany({
        select: { customerName: true, totalValue: true, paidAmount: true, status: true },
      }),
      prisma.salesOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    // Open receivable per customer name (documents denormalize customerName)
    const openBy: Record<string, number> = {};
    for (const i of invoices) {
      if (i.status === "PAID") continue;
      // Ledger-style fixed point: rows store paise — expose the rupee contract.
      const open = fromPaise(Number(i.totalValue || 0)) - fromPaise(Number(i.paidAmount || 0));
      if (open > 0) openBy[i.customerName] = (openBy[i.customerName] || 0) + open;
    }

    // Customer rows store creditLimit in integer paise — map to the rupee contract.
    const customersR = fromPaiseRows("Customer", customers);
    const rows = customersR.map((c: any) => ({
      ...c,
      openReceivable: Math.round(openBy[c.name] || 0),
      orderCount: 0,
    }));
    const soByCustomer = await prisma.salesOrder.groupBy({
      by: ["customerId"],
      _count: { _all: true },
    });
    const countMap = Object.fromEntries(soByCustomer.map((s) => [s.customerId, s._count._all]));
    for (const r of rows) r.orderCount = countMap[r.id] || 0;

    const totalExposure = rows.reduce((s, c) => s + c.openReceivable, 0);
    const soOpen =
      (salesOrders.find((s) => s.status === "CONFIRMED")?._count._all || 0) +
      (salesOrders.find((s) => s.status === "IN_PRODUCTION")?._count._all || 0) +
      (salesOrders.find((s) => s.status === "PARTIALLY_DISPATCHED")?._count._all || 0);

    return NextResponse.json({
      success: true,
      customers: rows,
      stats: {
        total: rows.length,
        active: rows.filter((c) => c.isActive).length,
        totalExposure: Math.round(totalExposure),
        openOrders: soOpen,
      },
    });
  } catch (error) {
    console.error("GET /api/commercial/customers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const createCustomerSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  type: z.enum(["DOMESTIC", "EXPORT"]).optional().default("DOMESTIC"),
  code: z.string().max(30).optional().nullable(),
  contactPerson: z.string().max(120).optional().nullable(),
  contactName: z.string().max(120).optional().nullable(),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  shippingAddress: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  gstin: z.string().max(30).optional().nullable(),
  pan: z.string().max(20).optional().nullable(),
  paymentTerms: z.string().max(40).optional().nullable(),
  creditLimit: z.coerce.number().nonnegative().optional().default(0),
  creditDays: z.coerce.number().int().nonnegative().max(365).optional().default(30),
  currency: z.string().max(10).optional().default("INR"),
  notes: z.string().max(1000).optional().nullable(),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        role: z.string().max(80).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        email: z.string().max(200).optional().nullable(),
      }),
    )
    .max(10)
    .optional()
    .default([]),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!user.isOwner &&
        !canAny(user, ["commercial.edit", "ops.edit", "system.edit"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const parsed = parseOr400(createCustomerSchema, body);
    if (!parsed.ok) return parsed.response;

    const d = parsed.data;
    const existing = await prisma.customer.findFirst({
      where: { name: { equals: d.name, mode: "insensitive" as any } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Customer "${d.name}" already exists.` },
        { status: 400 },
      );
    }

    // Stable human-friendly code: CUST-### (no year — it's an identity, not a doc)
    let code = d.code?.trim();
    if (!code) {
      const prefix = "CUST-";
      const last = await prisma.customer.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: "desc" },
        select: { code: true },
      });
      let seq = 1;
      const m = last?.code?.match(/(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
      code = `${prefix}${String(seq).padStart(3, "0")}`;
      // Collision-safe loop
      for (let i = 0; i < 100; i++) {
        const hit = await prisma.customer.findFirst({ where: { code } });
        if (!hit) break;
        seq += 1;
        code = `${prefix}${String(seq).padStart(3, "0")}`;
      }
    }

    const contactPerson = d.contactName || d.contactPerson || null;
    const customer = await prisma.customer.create({
      data: {
        code,
        name: d.name,
        type: d.type,
        contactPerson,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        billingAddress: d.billingAddress || d.address || null,
        shippingAddress: d.shippingAddress || null,
        city: d.city || null,
        state: d.state || null,
        gstin: d.gstin || null,
        pan: d.pan || null,
        paymentTerms: d.paymentTerms || "NET30",
        creditLimit: toPaise(d.creditLimit || 0),
        creditDays: d.creditDays ?? 30,
        currency: d.currency || "INR",
        notes: d.notes || null,
        createdBy: actor,
        contacts: {
          create:
            d.contacts?.map((c, idx) => ({
              name: c.name,
              role: c.role || null,
              phone: c.phone || null,
              email: c.email || null,
              isPrimary: idx === 0,
            })) || [],
        },
      },
      include: { contacts: true },
    });

    await logAudit({
      actor,
      action: "CUSTOMER_CREATED",
      entityType: "Customer",
      entityId: customer.id,
      details: `Created customer ${customer.code} ${customer.name} (${customer.type})`,
    });

    return NextResponse.json({ success: true, customer: fromPaiseRow("Customer", customer) });
  } catch (error) {
    console.error("POST /api/commercial/customers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}