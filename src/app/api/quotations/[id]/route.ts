import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { calculateQuotationEstimate } from "@/lib/estimatingEngine";
import { logAuditTx } from "@/lib/audit";
import {
  computeDiscountPct,
  discountApprovalFor,
  DISCOUNT_APPROVAL_THRESHOLD,
} from "@/lib/winLoss";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["commercial.view", "commercial.edit", "ops.view", "ops.edit", "system.view"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const quotation = await (prisma as any).quotation.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: {
              include: {
                bomLines: { include: { rawMaterial: true } },
              },
            },
          },
        },
        workOrder: true,
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 },
      );
    }

    const linesInput = quotation.lines.map((l: any) => ({
      productId: l.productId,
      plannedQty: l.plannedQty,
      unitPrice: l.unitPrice,
    }));

    const estimate = await calculateQuotationEstimate(
      linesInput,
      quotation.quotedPrice,
    );

    return NextResponse.json({ quotation, estimate });
  } catch (error: any) {
    console.error("GET /api/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const actor = user.name || "Admin";
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !canAny(user, [
        "commercial.edit",
        "ops.edit",
        "system.edit",
        "people.edit",
      ])
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    const existing = await (prisma as any).quotation.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 },
      );
    }

    if (action === "approve-discount") {
      if (existing.discountApprovalStatus !== "PENDING_MANAGER") {
        return NextResponse.json(
          {
            error: `Discount is not awaiting approval (${existing.discountApprovalStatus})`,
          },
          { status: 400 },
        );
      }
      const isManager =
        user.isOwner ||
        user.level === "MANAGER" ||
        canAny(user, ["commercial.edit", "ops.edit"]);
      if (!isManager) {
        return NextResponse.json(
          {
            error:
              "Manager approval required — discounts above 5% are restricted to department heads.",
          },
          { status: 403 },
        );
      }
      const updated = await prisma.$transaction(async (tx) => {
        const res = await (tx as any).quotation.update({
          where: { id },
          data: {
            discountApprovalStatus: "APPROVED",
            discountApprovedBy: actor,
            discountApprovedAt: new Date(),
            adjustmentHistory: [
              ...((existing.adjustmentHistory as any[]) || []),
              {
                action: "DISCOUNT_APPROVED",
                by: actor,
                at: new Date().toISOString(),
                reason: `${existing.discountPct}% discount approved`,
              },
            ],
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "QUOTE_DISCOUNT_APPROVED",
          entityType: "Quotation",
          entityId: id,
          details: `${existing.quoteNumber} — ${existing.discountPct}% discount approved by ${actor}`,
        });
        return res;
      });
      return NextResponse.json({ quotation: updated });
    }

    if (action === "reject-discount") {
      const reason = body.reason;
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          {
            error:
              "A written reason is required for rejecting a discount (audit trail).",
          },
          { status: 400 },
        );
      }
      const isManager =
        user.isOwner ||
        user.level === "MANAGER" ||
        canAny(user, ["commercial.edit", "ops.edit"]);
      if (!isManager) {
        return NextResponse.json(
          {
            error:
              "Manager approval required — discounts above 5% are restricted to department heads.",
          },
          { status: 403 },
        );
      }
      const updated = await prisma.$transaction(async (tx) => {
        const res = await (tx as any).quotation.update({
          where: { id },
          data: {
            discountApprovalStatus: "REJECTED",
            discountRejectedBy: actor,
            discountRejectReason: reason,
            adjustmentHistory: [
              ...((existing.adjustmentHistory as any[]) || []),
              {
                action: "DISCOUNT_REJECTED",
                by: actor,
                at: new Date().toISOString(),
                reason,
              },
            ],
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "QUOTE_DISCOUNT_REJECTED",
          entityType: "Quotation",
          entityId: id,
          details: `${existing.quoteNumber} — ${existing.discountPct}% discount rejected by ${actor}. Reason: ${reason}`,
        });
        return res;
      });
      return NextResponse.json({ quotation: updated });
    }

    const {
      status,
      notes,
      validUntil,
      customerName,
      customerContact,
      quotedPrice,
    } = body;

    const updateData: any = {};
    const statusGate = ["SENT", "WON", "CONVERTED"];
    if (status) {
      if (
        existing.discountApprovalStatus === "PENDING_MANAGER" &&
        statusGate.includes(status)
      ) {
        return NextResponse.json(
          {
            error: `QUOTE_DISCOUNT_PENDING: ${existing.quoteNumber} carries a ${existing.discountPct}% discount (>${DISCOUNT_APPROVAL_THRESHOLD}%) — a manager must approve it before the quote can be ${status}.`,
          },
          { status: 400 },
        );
      }
      updateData.status = status;
    }
    if (notes !== undefined) updateData.notes = notes;
    if (validUntil !== undefined)
      updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (customerName) updateData.customerName = customerName;
    if (customerContact !== undefined)
      updateData.customerContact = customerContact;

    if (quotedPrice !== undefined && quotedPrice > 0) {
      updateData.quotedPrice = quotedPrice;
      const margin =
        ((quotedPrice - existing.estimatedCost) / quotedPrice) * 100;
      updateData.marginPct = Number(margin.toFixed(1));

      // M15 — recompute the discount off the stored list prices and re-stamp approval.
      const listTotal = (existing.lines || []).reduce(
        (s: number, l: any) => s + (l.unitPrice || 0) * (l.plannedQty || 0),
        0,
      );
      const discountPct = computeDiscountPct(listTotal, quotedPrice);
      updateData.discountPct = discountPct;
      const approval = discountApprovalFor(discountPct);
      if (approval.discountApprovalStatus === "PENDING_MANAGER") {
        const isManager =
          user.isOwner ||
          user.level === "MANAGER" ||
          canAny(user, ["commercial.edit", "ops.edit"]);
        updateData.discountApprovalStatus = isManager
          ? "APPROVED"
          : "PENDING_MANAGER";
        updateData.discountApprovedBy = isManager ? actor : null;
        updateData.discountApprovedAt = isManager ? new Date() : null;
      } else {
        updateData.discountApprovalStatus = "APPROVED";
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await (tx as any).quotation.update({
        where: { id },
        data: {
          ...updateData,
          adjustmentHistory: [
            ...((existing.adjustmentHistory as any[]) || []),
            {
              action: "QUOTATION_UPDATED",
              by: actor,
              at: new Date().toISOString(),
              changes: updateData,
              reason: "Quote edit",
            },
          ],
        },
        include: {
          lines: { include: { product: true } },
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "UPDATED_QUOTATION",
        entityType: "Quotation",
        entityId: id,
        details: JSON.stringify(updateData),
      });

      if (
        updateData.discountPct !== undefined &&
        updateData.discountPct > DISCOUNT_APPROVAL_THRESHOLD &&
        updateData.discountApprovalStatus === "PENDING_MANAGER"
      ) {
        await logAuditTx(tx, {
          actor,
          action: "QUOTE_DISCOUNT_PENDING",
          entityType: "Quotation",
          entityId: id,
          details: `${existing.quoteNumber} — ${updateData.discountPct}% discount now awaits manager approval`,
        });
      }
      return res;
    });

    return NextResponse.json({ quotation: updated });
  } catch (error: any) {
    console.error("PATCH /api/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update quotation" },
      { status: 500 },
    );
  }
}
