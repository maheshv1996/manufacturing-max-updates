import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
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
    if (!user.id || (!user.isOwner && !canAny(user, ["commercial.view", "finance.view", "ops.view"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        salesOrders: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { lines: true },
        },
      },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("GET /api/commercial/customers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  contactPerson: z.string().max(120).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  shippingAddress: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  gstin: z.string().max(30).optional().nullable(),
  pan: z.string().max(20).optional().nullable(),
  paymentTerms: z.string().max(40).optional().nullable(),
  creditLimit: z.coerce.number().nonnegative().optional(),
  creditDays: z.coerce.number().int().nonnegative().max(365).optional(),
  currency: z.string().max(10).optional(),
  notes: z.string().max(1000).optional().nullable(),
  type: z.enum(["DOMESTIC", "EXPORT"]).optional(),
});

export async function PATCH(
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
    const parsed = parseOr400(updateSchema, body);
    if (!parsed.ok) return parsed.response;

    const data: any = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      data[k] = v === "" ? null : v;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
      include: { contacts: true },
    });

    await logAudit({
      actor,
      action: "CUSTOMER_UPDATED",
      entityType: "Customer",
      entityId: id,
      details: `Updated customer ${customer.code} ${customer.name}: ${Object.keys(data).join(", ")}`,
    });

    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    console.error("PATCH /api/commercial/customers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["activate", "hold", "inactivate"]),
  reason: z.string().max(500).optional().nullable(),
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

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const a = parsed.data.action;
    const isActive = a === "activate";
    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive },
    });

    await logAudit({
      actor,
      action: a === "activate" ? "CUSTOMER_ACTIVATED" : a === "hold" ? "CUSTOMER_ON_HOLD" : "CUSTOMER_INACTIVATED",
      entityType: "Customer",
      entityId: id,
      details: `${customer.code} ${customer.name} → ${a}${parsed.data.reason ? " — " + parsed.data.reason.slice(0, 120) : ""}`,
      severity: a === "hold" || a === "inactivate" ? "WARN" : "INFO",
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    console.error("POST /api/commercial/customers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}