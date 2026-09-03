import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { calculateQuotationEstimate } from "@/lib/estimatingEngine";
import { computeDiscountPct, discountApprovalFor } from "@/lib/winLoss";
import { parseOr400, quotationSchema } from "@/lib/validate";
import { nextSequenceTx } from "@/lib/sequence";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";

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
      { error: "Failed to fetch quotations" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const actor = user.name || user.id || "Admin";
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
    const headerClientId = headersList.get("x-client-id");
    const clientId: string | null = (body.clientId ? String(body.clientId).trim() : null) || (headerClientId ? String(headerClientId).trim() : null);
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Duplicate quotation request ignored" });
      }
    }

    // Validate shape (customerName + lines) via shared schema; quotedPrice is optional override
    const parsed = parseOr400(quotationSchema, body);
    if (!parsed.ok) return parsed.response;
    const { customerName, customerContact, validUntil, notes, lines } = parsed.data as any;
    const quotedPrice = (body as any).quotedPrice;

    const estimate = await calculateQuotationEstimate(lines, quotedPrice);
    const listTotal = estimate.lines.reduce((s: number, l: any) => s + (l.unitPrice || 0) * (l.plannedQty || 0), 0);
    const discountPct = computeDiscountPct(listTotal, estimate.quotedPrice);
    const approval = discountApprovalFor(discountPct);
    const isManager = user.isOwner || user.level === "MANAGER" || canAny(user, ["commercial.edit", "ops.edit"]);
    const autoApproved = isManager && approval.discountApprovalStatus === "PENDING_MANAGER";

    const result = await prisma.$transaction(async (tx) => {
      if (clientId) {
        const reserved = await reserveIdempotency(tx as any, clientId, "/api/quotations");
        if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
      }
      const quoteNumber = await nextSequenceTx(tx as any, "QT", 3);
      const quotationTx = await (tx as any).quotation.create({
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
          discountApprovalStatus: autoApproved ? "APPROVED" : approval.discountApprovalStatus,
          discountApprovedBy: autoApproved ? actor : null,
          discountApprovedAt: autoApproved ? new Date() : null,
          lines: {
            create: estimate.lines.map((l: any) => ({
              productId: l.productId,
              plannedQty: l.plannedQty,
              unitPrice: l.unitPrice,
              subtotal: l.subtotal,
            })),
          },
        },
        include: { lines: { include: { product: { select: { id: true, name: true, sku: true } } } } },
      });

      await (tx as any).auditLog.create({
        data: {
          actor,
          action: "CREATED_QUOTATION",
          entityType: "Quotation",
          entityId: quotationTx.id,
          details: JSON.stringify({
            quoteNumber,
            customerName,
            quotedPrice: estimate.quotedPrice,
            marginPct: estimate.marginPct,
            discountPct,
            discountApprovalStatus: quotationTx.discountApprovalStatus,
          }),
        },
      });

      if (approval.discountApprovalStatus === "PENDING_MANAGER") {
        await (tx as any).auditLog.create({
          data: {
            actor,
            action: "QUOTE_DISCOUNT_PENDING",
            entityType: "Quotation",
            entityId: quotationTx.id,
            details: `${quoteNumber} — ${discountPct}% discount (₹${(listTotal - estimate.quotedPrice).toLocaleString("en-IN")} off ${listTotal.toLocaleString("en-IN")}) needs a manager${autoApproved ? " — auto-approved (actor is a manager)" : ""}`,
          },
        });
      }

      return { quotation: quotationTx, estimate };
    });

    if (clientId) await completeIdempotency(clientId, result);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error?.code === "DUPLICATE") return NextResponse.json({ success: true, duplicate: true, message: "Duplicate quotation request ignored" });
    console.error("POST /api/quotations error:", error);
    return NextResponse.json({ error: "Failed to create quotation" }, { status: 500 });
  }
}
