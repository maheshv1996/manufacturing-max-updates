import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const WRITE_GATE = ["commercial.edit", "ops.edit", "system.edit"];

const contactSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    name: z.string().min(1).max(120),
    role: z.string().max(80).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    email: z.string().max(200).optional().nullable(),
    isPrimary: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("remove"),
    contactId: z.string().min(1),
  }),
  z.object({
    action: z.literal("setPrimary"),
    contactId: z.string().min(1),
  }),
]);

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
    const parsed = parseOr400(contactSchema, body);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { contacts: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let result;
    if (d.action === "add") {
      const isFirst = customer.contacts.length === 0;
      result = await prisma.customerContact.create({
        data: {
          customerId: id,
          name: d.name,
          role: d.role || null,
          phone: d.phone || null,
          email: d.email || null,
          isPrimary: d.isPrimary ?? isFirst,
        },
      });
      if (d.isPrimary) {
        await prisma.customerContact.updateMany({
          where: { customerId: id, id: { not: result.id } },
          data: { isPrimary: false },
        });
      }
      await logAudit({
        actor,
        action: "CUSTOMER_CONTACT_ADDED",
        entityType: "Customer",
        entityId: id,
        details: `Added contact ${d.name} to ${customer.code} ${customer.name}`,
      });
    } else if (d.action === "remove") {
      const wasPrimary = customer.contacts.find((c) => c.id === d.contactId)?.isPrimary;
      await prisma.customerContact.delete({ where: { id: d.contactId } });
      if (wasPrimary) {
        const next = await prisma.customerContact.findFirst({
          where: { customerId: id },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await prisma.customerContact.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
      result = { removed: d.contactId };
      await logAudit({
        actor,
        action: "CUSTOMER_CONTACT_REMOVED",
        entityType: "Customer",
        entityId: id,
        details: `Removed contact from ${customer.code} ${customer.name}`,
        severity: "WARN",
      });
    } else {
      await prisma.customerContact.updateMany({
        where: { customerId: id },
        data: { isPrimary: false },
      });
      result = await prisma.customerContact.update({
        where: { id: d.contactId },
        data: { isPrimary: true },
      });
      await logAudit({
        actor,
        action: "CUSTOMER_CONTACT_PRIMARY",
        entityType: "Customer",
        entityId: id,
        details: `Primary contact set for ${customer.code} ${customer.name}`,
      });
    }

    const contacts = await prisma.customerContact.findMany({
      where: { customerId: id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ success: true, contact: result, contacts });
  } catch (error) {
    console.error("POST /api/commercial/customers/[id]/contacts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}