import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { monthKey } from "@/lib/fixedAssets";

export const dynamic = "force-dynamic";

const MF_GATE = [
  "finance.edit",
  "commercial.edit",
  "ops.edit",
  "system.edit",
  "people.edit",
];
const CASH_TYPES = ["PAYMENT", "RECEIPT"];

// Manager checks & posts (or rejects). PENDING_CHECK alone never touches the ledger.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !canAny(user, MF_GATE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const mgr = await requireManagerLevel(user);
    if (!mgr.ok)
      return NextResponse.json({ error: mgr.error }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    const voucher = await prisma.voucher.findUnique({ where: { id } });
    if (!voucher)
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    if (voucher.status !== "PENDING_CHECK") {
      return NextResponse.json(
        {
          error: `Only unchecked vouchers can be decided — this one is ${voucher.status}.`,
        },
        { status: 400 },
      );
    }

    if (action === "check-post") {
      const updated = await prisma.voucher.update({
        where: { id },
        data: {
          status: "POSTED",
          checkedBy: actor,
          checkedAt: new Date(),
          postedToTreasury: CASH_TYPES.includes(voucher.voucherType),
        },
      });
      if (CASH_TYPES.includes(voucher.voucherType)) {
        await prisma.treasuryTransaction.create({
          data: {
            date: voucher.voucherDate,
            type: voucher.voucherType === "PAYMENT" ? "OUTFLOW" : "INFLOW",
            account: voucher.account || "Main",
            amount: voucher.amount,
            reference: voucher.voucherNumber,
            category: `Voucher ${voucher.voucherType}`,
            notes: `${voucher.voucherNumber} — ${voucher.particulars.slice(0, 80)}`,
          },
        });
      }
      if (voucher.voucherType === "DEPRECIATION" && voucher.sourceAssetId) {
        // M19 — posting the draft books the actual depreciation entry.
        const asset = await prisma.fixedAsset.findUnique({
          where: { id: voucher.sourceAssetId },
        });
        if (asset && asset.status === "ACTIVE") {
          const period = monthKey(voucher.voucherDate);
          const existingEntry = await prisma.assetDepreciationEntry.findUnique({
            where: { assetId_period: { assetId: asset.id, period } },
          });
          if (!existingEntry) {
            await prisma.assetDepreciationEntry.create({
              data: {
                assetId: asset.id,
                period,
                amount: voucher.amount,
                bookedBy: actor,
                voucherId: id,
              },
            });
            const accumulated = asset.accumulatedDepreciation + voucher.amount;
            await prisma.fixedAsset.update({
              where: { id: asset.id },
              data: {
                accumulatedDepreciation: accumulated,
                bookValue: asset.cost - accumulated,
              },
            });
            await logAudit({
              actor,
              action: "ASSET_DEPRECIATION_BOOKED",
              entityType: "FIXED_ASSET",
              entityId: asset.id,
              details: `${period} ₹${voucher.amount} via ${voucher.voucherNumber}`,
            });
          }
        }
      }
      await logAudit({
        actor,
        action: "VOUCHER_POSTED",
        entityType: "VOUCHER",
        entityId: id,
        details: `${voucher.voucherNumber} ${voucher.voucherType} ₹${voucher.amount} checked & posted → ${CASH_TYPES.includes(voucher.voucherType) ? "treasury ledger" : "books (non-cash)"}`,
      });
      return NextResponse.json({ voucher: updated });
    }

    if (action === "reject") {
      const reason = validateReason(body);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const updated = await prisma.voucher.update({
        where: { id },
        data: {
          status: "REJECTED",
          checkedBy: actor,
          checkedAt: new Date(),
          rejectReason: reason.reason,
        },
      });
      await logAudit({
        actor,
        action: "VOUCHER_REJECTED",
        entityType: "VOUCHER",
        entityId: id,
        details: `${voucher.voucherNumber} ₹${voucher.amount} rejected — ${reason.reason}`,
      });
      return NextResponse.json({ voucher: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/vouchers/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update voucher" },
      { status: 500 },
    );
  }
}
