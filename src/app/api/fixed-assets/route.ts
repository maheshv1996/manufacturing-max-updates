import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { monthDepreciation, monthKey, periodLabel } from "@/lib/fixedAssets";
import { nextVoucherNumber } from "@/lib/voucherNumbers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CATEGORIES = [
  "MACHINERY",
  "VEHICLE",
  "FURNITURE_FIXTURES",
  "COMPUTER_EQUIPMENT",
  "EQUIPMENT",
  "BUILDING",
  "LAND",
  "OTHER",
];

async function nextAssetCode(): Promise<string> {
  const prefix = `FA-${new Date().getFullYear()}-`;
  const last = await prisma.fixedAsset.findFirst({
    where: { assetCode: { startsWith: prefix } },
    orderBy: { assetCode: "desc" },
    select: { assetCode: true },
  });
  let seq = 1;
  if (last) {
    const n = parseInt(last.assetCode.replace(prefix, ""), 10);
    if (!isNaN(n)) seq = n + 1;
  }
  let code = `${prefix}${String(seq).padStart(3, "0")}`;
  for (;;) {
    const existing = await prisma.fixedAsset.findUnique({
      where: { assetCode: code },
      select: { id: true },
    });
    if (!existing) break;
    seq += 1;
    code = `${prefix}${String(seq).padStart(3, "0")}`;
  }
  return code;
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!user.isOwner && !canAny(user, ["finance.view", "commercial.view"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [assets, entries, depreciationDrafts] = await Promise.all([
      prisma.fixedAsset.findMany({
        orderBy: { purchaseDate: "desc" },
        take: 300,
      }),
      prisma.assetDepreciationEntry.findMany({
        orderBy: { period: "desc" },
        take: 2000,
      }),
      prisma.voucher.findMany({
        where: { voucherType: "DEPRECIATION", status: "PENDING_CHECK" },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const assetsWith = assets.map((a) => ({
      ...a,
      entries: entries
        .filter((e) => e.assetId === a.id)
        .sort((x, y) => x.period.localeCompare(y.period)),
      bookValueNow: a.bookValue,
      nextCharge: monthDepreciation(
        a,
        monthKey(new Date()),
        a.accumulatedDepreciation,
      ),
    }));

    const byPeriod = new Map<string, number>();
    for (const e of entries)
      byPeriod.set(e.period, (byPeriod.get(e.period) || 0) + e.amount);

    return NextResponse.json({
      assets: assetsWith,
      metrics: {
        assetCount: assets.length,
        grossCost: assets.reduce((s, a) => s + a.cost, 0),
        accumulated: assets.reduce((s, a) => s + a.accumulatedDepreciation, 0),
        bookValue: assets.reduce((s, a) => s + a.bookValue, 0),
      },
      byPeriod: [...byPeriod.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([period, amount]) => ({
          period,
          label: periodLabel(period),
          amount,
        })),
      depreciationDrafts,
    });
  } catch (error) {
    console.error("GET /api/fixed-assets error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!user.isOwner && !canAny(user, ["finance.edit", "commercial.edit"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;

    if (action === "create" || action === "update") {
      const {
        id,
        assetCode,
        name,
        category,
        purchaseDate,
        cost,
        salvageValue,
        usefulLifeMonths,
        method,
        notes,
      } = body;
      if (!name?.trim())
        return NextResponse.json(
          { error: "Asset name is required" },
          { status: 400 },
        );
      if (!CATEGORIES.includes(category))
        return NextResponse.json(
          { error: "Invalid category" },
          { status: 400 },
        );
      if (!["STRAIGHT_LINE", "WDV"].includes(method))
        return NextResponse.json({ error: "Invalid method" }, { status: 400 });
      const costN = Number(cost);
      const salvageN = Number(salvageValue || 0);
      const lifeN = Number(usefulLifeMonths || 60);
      if (isNaN(costN) || costN <= 0)
        return NextResponse.json(
          { error: "Cost must be > 0" },
          { status: 400 },
        );
      if (isNaN(salvageN) || salvageN < 0 || salvageN >= costN)
        return NextResponse.json(
          { error: "Salvage must be ≥ 0 and below cost" },
          { status: 400 },
        );
      if (isNaN(lifeN) || lifeN < 1)
        return NextResponse.json(
          { error: "usefulLifeMonths must be ≥ 1" },
          { status: 400 },
        );
      const pDate = new Date(purchaseDate);
      if (isNaN(pDate.getTime()))
        return NextResponse.json(
          { error: "Invalid purchaseDate" },
          { status: 400 },
        );

      const data = {
        name: name.trim(),
        category,
        purchaseDate: pDate,
        cost: costN,
        salvageValue: salvageN,
        usefulLifeMonths: Math.round(lifeN),
        method,
        notes: notes || null,
      };

      if (action === "create") {
        const asset = await prisma.fixedAsset.create({
          data: {
            ...data,
            assetCode: assetCode?.trim() || (await nextAssetCode()),
            bookValue: costN,
          },
        });
        await logAudit({
          actor,
          action: "ASSET_CREATED",
          entityType: "FIXED_ASSET",
          entityId: asset.id,
          details: `${asset.assetCode} ${asset.name} ₹${costN} ${method}`,
        });
        return NextResponse.json({ asset });
      }

      const existing = await prisma.fixedAsset.findUnique({ where: { id } });
      if (!existing)
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      if (existing.status === "DISPOSED")
        return NextResponse.json(
          { error: "Disposed assets cannot be edited" },
          { status: 400 },
        );
      const asset = await prisma.fixedAsset.update({
        where: { id },
        data: { ...data, bookValue: costN - existing.accumulatedDepreciation },
      });
      await logAudit({
        actor,
        action: "ASSET_UPDATED",
        entityType: "FIXED_ASSET",
        entityId: id,
        details: `${asset.assetCode} ${asset.name} updated`,
      });
      return NextResponse.json({ asset });
    }

    if (action === "dispose") {
      const { id, notes } = body;
      if (!notes?.trim())
        return NextResponse.json(
          { error: "Disposal note required (audit trail)" },
          { status: 400 },
        );
      const existing = await prisma.fixedAsset.findUnique({ where: { id } });
      if (!existing)
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      const asset = await prisma.fixedAsset.update({
        where: { id },
        data: {
          status: "DISPOSED",
          disposedAt: new Date(),
          notes: notes.trim(),
        },
      });
      await logAudit({
        actor,
        action: "ASSET_DISPOSED",
        entityType: "FIXED_ASSET",
        entityId: id,
        details: `${asset.assetCode} ${asset.name} disposed — ${notes.trim()}`,
      });
      return NextResponse.json({ asset });
    }

    if (action === "generate-period") {
      // M19 → M17: book nothing here — create DEPRECIATION voucher DRAFTS
      // that a manager checks and posts; entries are booked at post time.
      const { period } = body;
      if (!/^\d{4}-\d{2}$/.test(period || ""))
        return NextResponse.json(
          { error: "period must be YYYY-MM" },
          { status: 400 },
        );

      const assets = await prisma.fixedAsset.findMany({
        where: { status: "ACTIVE" },
      });
      const existingEntries = await prisma.assetDepreciationEntry.findMany({
        where: { period },
        select: {
          assetId: true,
          voucher: { select: { id: true, voucherNumber: true } },
        },
      });
      const bookedIds = new Set(existingEntries.map((e) => e.assetId));
      const draftVoucherIds = new Set(
        existingEntries.filter((e) => e.voucher).map((e) => e.voucher!.id),
      );

      const made: {
        assetCode: string;
        name: string;
        amount: number;
        voucherNumber: string;
      }[] = [];
      const skipped: string[] = [];

      for (const asset of assets) {
        const charge = monthDepreciation(
          asset,
          period,
          asset.accumulatedDepreciation,
        );
        if (!charge || charge <= 0) {
          skipped.push(`${asset.assetCode} (0)`);
          continue;
        }
        if (bookedIds.has(asset.id)) {
          skipped.push(`${asset.assetCode} (already booked)`);
          continue;
        }
        const voucher = await prisma.voucher.create({
          data: {
            voucherNumber: await nextVoucherNumber(
              new Date(period + "-01T00:00:00.000Z"),
            ),
            voucherType: "DEPRECIATION",
            amount: charge,
            particulars: `Depreciation ${asset.name} — ${periodLabel(period)}`,
            voucherDate: new Date(period + "-01T00:00:00.000Z"),
            status: "PENDING_CHECK",
            enteredBy: actor,
            sourceAssetId: asset.id,
          },
        });
        made.push({
          assetCode: asset.assetCode,
          name: asset.name,
          amount: charge,
          voucherNumber: voucher.voucherNumber,
        });
      }

      await logAudit({
        actor,
        action: "DEPRECIATION_DRAFTS",
        entityType: "DEPRECIATION",
        entityId: period,
        details: `${periodLabel(period)}: ${made.length} voucher draft(s) created (${skipped.length} skipped)`,
      });

      return NextResponse.json({
        made,
        skipped,
        draftsPending: made.length,
        alreadyDrafted: draftVoucherIds.size,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/fixed-assets error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
