import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { generateQuoteNumber } from "@/lib/quotations";
import { calculateQuotationEstimate } from "@/lib/estimatingEngine";
import { computeDiscountPct, discountApprovalFor } from "@/lib/winLoss";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const quotations = await (prisma as any).quotation.findMany({
      include: {
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        workOrder: { select: { id: true, woNumber: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ quotations });
  } catch (error: any) {
    console.error("GET /api/quotations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotations", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "QUOTATION_CREATED", entityType: "Quotation", details: "Quotation created" });
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const actor = user.name || "Admin";
    if (
      !user.id ||
      (!user.isOwner &&
        !canAny(user, [
          "commercial.edit",
          "ops.edit",
          "system.edit",
          "people.edit",
        ]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      customerName,
      customerContact,
      validUntil,
      notes,
      lines,
      quotedPrice,
    } = body;

    if (
      !customerName ||
      !lines ||
      !Array.isArray(lines) ||
      lines.length === 0
    ) {
      return NextResponse.json(
        { error: "Customer name and at least 1 quotation line are required" },
        { status: 400 },
      );
    }

    const quoteNumber = await generateQuoteNumber();
    const estimate = await calculateQuotationEstimate(lines, quotedPrice);
    const listTotal = estimate.lines.reduce(
      (s: number, l: any) => s + (l.unitPrice || 0) * (l.plannedQty || 0),
      0,
    );
    const discountPct = computeDiscountPct(listTotal, estimate.quotedPrice);
    const approval = discountApprovalFor(discountPct);
    const isManager =
      user.isOwner ||
      user.level === "MANAGER" ||
      canAny(user, ["commercial.edit", "ops.edit"]);
    const autoApproved =
      isManager && approval.discountApprovalStatus === "PENDING_MANAGER";

    const quotation = await (prisma as any).quotation.create({
      data: {
        quoteNumber,
        customerName,
        customerContact: customerContact || null,
        status: "DRAFT",
        validUntil: validUntil ? new Date(validUntil) : null,
        estimatedCost: estimate.estimatedCost,
        quotedPrice: estimate.quotedPrice,
        marginPct: estimate.marginPct,
        notes: notes || null,
        discountPct,
        discountApprovalStatus: autoApproved
          ? "APPROVED"
          : approval.discountApprovalStatus,
        discountApprovedBy: autoApproved ? actor : null,
        discountApprovedAt: autoApproved ? new Date() : null,
        lines: {
          create: estimate.lines.map((l) => ({
            productId: l.productId,
            plannedQty: l.plannedQty,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
          })),
        },
      },
      include: {
        lines: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor,
        action: "CREATED_QUOTATION",
        entityType: "Quotation",
        entityId: quotation.id,
        details: JSON.stringify({
          quoteNumber,
          customerName,
          quotedPrice: estimate.quotedPrice,
          marginPct: estimate.marginPct,
          discountPct,
          discountApprovalStatus: quotation.discountApprovalStatus,
        }),
      },
    });

    if (approval.discountApprovalStatus === "PENDING_MANAGER") {
      await prisma.auditLog.create({
        data: {
          actor,
          action: "QUOTE_DISCOUNT_PENDING",
          entityType: "Quotation",
          entityId: quotation.id,
          details: `${quoteNumber} — ${discountPct}% discount (₹${(listTotal - estimate.quotedPrice).toLocaleString("en-IN")} off ${listTotal.toLocaleString("en-IN")}) needs a manager${autoApproved ? " — auto-approved (actor is a manager)" : ""}`,
        },
      });
    }

    return NextResponse.json({ quotation, estimate }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/quotations error:", error);
    return NextResponse.json(
      { error: "Failed to create quotation", details: error.message },
      { status: 500 },
    );
  }
}
