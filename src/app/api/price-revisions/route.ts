import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { addYears, differenceInDays } from "date-fns";

export const maxDuration = 60;

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const revisions = await prisma.priceRevision.findMany({
      include: {
        product: {
          select: { sku: true, name: true, sellingPricePerUnit: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Contractual annual increases: next due = effectiveDate + 1 year
    const now = new Date();
    const dueSoon = revisions
      .filter((r) => r.status === "APPROVED")
      .map((r) => {
        const nextDue = addYears(new Date(r.effectiveDate), 1);
        const daysLeft = differenceInDays(nextDue, now);
        return { ...r, nextDue: nextDue.toISOString(), daysLeft };
      })
      .filter((r) => daysLeft(r) <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, sellingPricePerUnit: true },
      orderBy: { sku: "asc" },
    });

    return NextResponse.json({
      revisions: revisions.map((r) => ({
        ...r,
        effectiveDate: r.effectiveDate.toISOString(),
      })),
      dueSoon: dueSoon.map((r) => ({
        ...r,
        effectiveDate: r.effectiveDate.toISOString(),
      })),
      products,
    });
  } catch (error) {
    console.error("GET /api/price-revisions error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

function daysLeft(r: any) {
  return r.daysLeft;
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAny(user, ["commercial.edit"])))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );

    if (action === "create") {
      const { productId, newPrice, effectiveDate, reason } = data;
      if (!productId || !newPrice || !effectiveDate)
        return NextResponse.json(
          { error: "productId, newPrice, effectiveDate required" },
          { status: 400 },
        );
      const price = Number(newPrice);
      if (!(price >= 0))
        return NextResponse.json(
          { error: "Invalid newPrice" },
          { status: 400 },
        );
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product)
        return NextResponse.json(
          { error: "Product not found" },
          { status: 404 },
        );
      const oldPrice = product.sellingPricePerUnit ?? 0;
      const increasePct =
        oldPrice > 0
          ? Math.round(((price - oldPrice) / oldPrice) * 1000) / 10
          : 0;
      const revision = await prisma.priceRevision.create({
        data: {
          revisionNumber: `PR-${new Date().getFullYear()}-${product.sku}-${String(Math.floor(10 + Math.random() * 90))}`,
          productId,
          oldPrice,
          newPrice: price,
          increasePct,
          effectiveDate: new Date(effectiveDate),
          reason: reason || null,
          status: "DRAFT",
          createdByName: user.name || "System",
        },
      });
      await logAudit({
        actor: user.name || "System",
        action: "PRICE_REVISION_DRAFTED",
        entityType: "PRICE_REVISION",
        entityId: revision.id,
        details: `${product.sku} ${oldPrice} → ${price} (${increasePct}%)`,
      });
      return NextResponse.json({ revision }, { status: 201 });
    }

    if (action === "apply-annual") {
      const { pct, effectiveDate } = data;
      const p = Number(pct);
      const eff = effectiveDate ? new Date(effectiveDate) : new Date();
      if (!(p > 0 && p <= 100))
        return NextResponse.json(
          { error: "pct must be 0–100" },
          { status: 400 },
        );
      const products = await prisma.product.findMany({
        where: { isActive: true },
      });
      const created: any[] = [];
      for (const [i, product] of products.entries()) {
        const oldPrice = product.sellingPricePerUnit ?? 0;
        const newPrice = Math.round(oldPrice * (1 + p / 100) * 100) / 100;
        const revision = await prisma.priceRevision.create({
          data: {
            revisionNumber: `PR-${eff.getFullYear()}-A${i + 1}-${Date.now().toString(36)}`,
            productId: product.id,
            oldPrice,
            newPrice,
            increasePct: p,
            effectiveDate: eff,
            reason: `Annual contractual increase ${p}%`,
            status: "DRAFT",
            createdByName: user.name || "System",
          },
        });
        created.push(revision.id);
      }
      await logAudit({
        actor: user.name || "System",
        action: "PRICE_REVISION_ANNUAL",
        entityType: "PRICE_REVISION",
        entityId: undefined,
        details: `${p}% annual increase — ${created.length} draft revision(s) created`,
      });
      return NextResponse.json({ count: created.length }, { status: 201 });
    }

    if (action === "approve" || action === "reject") {
      const { id, reason } = data;
      if (!id || !validateReason(reason))
        return NextResponse.json(
          { error: "id and reason required" },
          { status: 400 },
        );
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json(
          { error: "Manager level required" },
          { status: 403 },
        );
      const revision = await prisma.priceRevision.findUnique({ where: { id } });
      if (!revision)
        return NextResponse.json(
          { error: "Revision not found" },
          { status: 404 },
        );

      if (action === "approve") {
        const updated = await prisma.priceRevision.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedByName: user.name || "System",
            approvedAt: new Date(),
            reason,
            adjustmentHistory: [
              ...((revision.adjustmentHistory as any[]) || []),
              {
                action: "APPROVED",
                by: user.name || "System",
                at: new Date().toISOString(),
                reason,
              },
            ],
          },
        });
        // Manager-approved price list BECOMES the quote default
        await prisma.product.update({
          where: { id: revision.productId },
          data: { sellingPricePerUnit: revision.newPrice },
        });
        await logAudit({
          actor: user.name || "System",
          action: "PRICE_REVISION_APPROVED",
          entityType: "PRICE_REVISION",
          entityId: id,
          details: `${revision.oldPrice} → ${revision.newPrice} (${revision.increasePct}%) — quote default updated`,
        });
        return NextResponse.json({ revision: updated });
      }
      const updated = await prisma.priceRevision.update({
        where: { id },
        data: {
          status: "REJECTED",
          approvedByName: user.name || "System",
          approvedAt: new Date(),
          reason,
          adjustmentHistory: [
            ...((revision.adjustmentHistory as any[]) || []),
            {
              action: "REJECTED",
              by: user.name || "System",
              at: new Date().toISOString(),
              reason,
            },
          ],
        },
      });
      await logAudit({
        actor: user.name || "System",
        action: "PRICE_REVISION_REJECTED",
        entityType: "PRICE_REVISION",
        entityId: id,
        details: reason,
      });
      return NextResponse.json({ revision: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/price-revisions error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
