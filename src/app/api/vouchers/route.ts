import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { nextVoucherNumber } from "@/lib/voucherNumbers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const MF_GATE = [
  "finance.edit",
  "commercial.edit",
  "ops.edit",
  "system.edit",
  "people.edit",
];

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

    const [vouchers, stats] = await Promise.all([
      prisma.voucher.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.voucher.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const now = new Date();
    const prefix = `VCH-${now.getFullYear()}-`;
    const thisYear = vouchers.filter((v) => v.voucherNumber.startsWith(prefix));

    return NextResponse.json({
      vouchers,
      stats: {
        pending:
          stats.find((s) => s.status === "PENDING_CHECK")?._count._all || 0,
        posted: stats.find((s) => s.status === "POSTED")?._count._all || 0,
        rejected: stats.find((s) => s.status === "REJECTED")?._count._all || 0,
        postedValueYear: thisYear
          .filter((v) => v.status === "POSTED")
          .reduce((a, v) => a + v.amount, 0),
        pendingValue:
          stats.find((s) => s.status === "PENDING_CHECK")?._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/vouchers error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// Maker enters a voucher — it sits PENDING_CHECK and can NEVER post itself.
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !canAny(user, MF_GATE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const body = await req.json();
    const { voucherType, amount, account, particulars, voucherDate } = body;
    if (
      !voucherType ||
      !amount ||
      Number(amount) <= 0 ||
      !particulars?.trim()
    ) {
      return NextResponse.json(
        { error: "voucherType, amount (>0) and particulars are required" },
        { status: 400 },
      );
    }
    if (
      !["PAYMENT", "RECEIPT", "JOURNAL", "DEPRECIATION", "ADJUSTMENT"].includes(
        voucherType,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid voucherType" },
        { status: 400 },
      );
    }

    const date = voucherDate ? new Date(voucherDate) : new Date();
    const voucherNumber = await nextVoucherNumber(date);

    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        voucherType,
        amount: Number(amount),
        account: account || "Main",
        particulars: particulars.trim(),
        voucherDate: date,
        status: "PENDING_CHECK",
        enteredBy: actor,
      },
    });

    await logAudit({
      actor,
      action: "VOUCHER_CREATED",
      entityType: "VOUCHER",
      entityId: voucher.id,
      details: `${voucherNumber} ${voucherType} ₹${Number(amount)} — entered, awaiting manager check`,
    });

    return NextResponse.json({ voucher });
  } catch (error: any) {
    console.error("POST /api/vouchers error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create voucher" },
      { status: 500 },
    );
  }
}
