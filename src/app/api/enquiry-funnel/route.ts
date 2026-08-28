import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { WIN_LOSS_REASONS } from "@/lib/winLoss";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!user.isOwner && !canAny(user, ["commercial.view", "commercial.edit"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const quotations = await prisma.quotation.findMany({
      select: {
        quoteNumber: true,
        customerName: true,
        status: true,
        quotedPrice: true,
        createdAt: true,
        lastFollowUpAt: true,
        lostReason: true,
        wonReason: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const STAGES = ["DRAFT", "SENT", "WON", "LOST", "CONVERTED"] as const;
    const stages = STAGES.map((s) => {
      const rows = quotations.filter((q) => q.status === s);
      return {
        stage: s,
        count: rows.length,
        value: rows.reduce((a, q) => a + (q.quotedPrice || 0), 0),
      };
    });

    const decided = quotations.filter(
      (q) =>
        q.status === "WON" || q.status === "LOST" || q.status === "CONVERTED",
    );
    const won = quotations.filter(
      (q) => q.status === "WON" || q.status === "CONVERTED",
    );
    const lost = quotations.filter((q) => q.status === "LOST");

    const reasons = WIN_LOSS_REASONS.map((r) => ({
      reason: r,
      won: quotations.filter((q) => q.status === "WON" && q.wonReason === r)
        .length,
      lost: quotations.filter((q) => q.status === "LOST" && q.lostReason === r)
        .length,
    }));

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const idle = quotations
      .filter((q) => q.status === "DRAFT" || q.status === "SENT")
      .map((q) => {
        const last = q.lastFollowUpAt
          ? new Date(q.lastFollowUpAt).getTime()
          : new Date(q.createdAt).getTime();
        return { ...q, daysIdle: Math.max(0, Math.floor((now - last) / DAY)) };
      });

    return NextResponse.json({
      stages,
      totals: {
        total: quotations.length,
        decided: decided.length,
        won: won.length,
        lost: lost.length,
        open: quotations.length - decided.length,
        winRate:
          decided.length > 0
            ? Math.round((won.length / decided.length) * 100)
            : 0,
        decidedValue: decided.reduce((a, q) => a + (q.quotedPrice || 0), 0),
        wonValue: won.reduce((a, q) => a + (q.quotedPrice || 0), 0),
        lostValue: lost.reduce((a, q) => a + (q.quotedPrice || 0), 0),
      },
      reasons,
      idle: idle.filter((q) => q.daysIdle >= 7),
      stale: idle.filter(
        (q) => now - new Date(q.createdAt).getTime() > 30 * DAY,
      ),
    });
  } catch (error) {
    console.error("GET /api/enquiry-funnel error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
