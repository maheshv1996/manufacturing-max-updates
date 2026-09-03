import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { nextSequenceTx } from "@/lib/sequence";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

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

const voucherCreateSchema = z.object({
  voucherType: z.enum(["PAYMENT", "RECEIPT", "JOURNAL", "DEPRECIATION", "ADJUSTMENT"]),
  amount: z.coerce.number().positive().max(100_000_000),
  account: z.string().max(100).optional().default("Main"),
  particulars: z.string().min(1).max(2000).transform((s) => s.trim()),
  voucherDate: z.string().optional().nullable(),
  clientId: z.string().max(200).optional().nullable(),
});

// Maker enters a voucher — it sits PENDING_CHECK and can NEVER post itself.
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !canAny(user, MF_GATE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const headerClientId = headersList.get("x-client-id");
    const clientId: string | null = (body.clientId ? String(body.clientId).trim() : null) || (headerClientId ? String(headerClientId).trim() : null);
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Duplicate voucher request ignored" });
      }
    }

    const parsed = parseOr400(voucherCreateSchema, body);
    if (!parsed.ok) return parsed.response;
    const { voucherType, amount, account, particulars, voucherDate } = parsed.data as any;

    const date = voucherDate ? new Date(voucherDate) : new Date();
    if (isNaN(date.getTime())) return NextResponse.json({ error: "Invalid voucherDate" }, { status: 400 });

    const voucher = await prisma.$transaction(async (tx) => {
      if (clientId) {
        const reserved = await reserveIdempotency(tx as any, clientId, "/api/vouchers");
        if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
      }
      const voucherNumber = await nextSequenceTx(tx as any, "VCH", 4, date);
      const created = await (tx as any).voucher.create({
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
      await (tx as any).auditLog.create({
        data: {
          actor,
          action: "VOUCHER_CREATED",
          entityType: "VOUCHER",
          entityId: created.id,
          details: `${voucherNumber} ${voucherType} ₹${Number(amount)} — entered, awaiting manager check`,
        },
      });
      return created;
    });

    const payload = { voucher };
    if (clientId) await completeIdempotency(clientId, payload);
    return NextResponse.json(payload);
  } catch (error: any) {
    if (error?.code === "DUPLICATE") return NextResponse.json({ success: true, duplicate: true, message: "Duplicate voucher request ignored" });
    console.error("POST /api/vouchers error:", error);
    return NextResponse.json({ error: "Failed to create voucher" }, { status: 500 });
  }
}
