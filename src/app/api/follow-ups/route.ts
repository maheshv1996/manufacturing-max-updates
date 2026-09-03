import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { WIN_LOSS_REASONS } from "@/lib/winLoss";

export const dynamic = "force-dynamic";

const LOST_REASONS = WIN_LOSS_REASONS as unknown as string[];
import { differenceInCalendarDays } from "date-fns";

export const maxDuration = 60;

function lastActivity(q: any): Date {
  return q.lastFollowUpAt ? new Date(q.lastFollowUpAt) : new Date(q.createdAt);
}

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const quotations = await prisma.quotation.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const now = new Date();
    const idle = quotations
      .filter((q) => ["DRAFT", "SENT"].includes(q.status))
      .map((q) => ({
        ...q,
        daysIdle: differenceInCalendarDays(now, lastActivity(q)),
      }))
      .filter((q) => q.daysIdle >= 7)
      .sort((a, b) => b.daysIdle - a.daysIdle);

    // Lost-reason analytics for managers
    const lost = quotations.filter((q) => q.status === "LOST");
    const lostByReason = LOST_REASONS.map((reason) => ({
      reason,
      count: lost.filter((q) => (q.lostReason || "OTHER") === reason).length,
      value: lost
        .filter((q) => (q.lostReason || "OTHER") === reason)
        .reduce((s, q) => s + (q.quotedPrice || 0), 0),
    })).filter((r) => r.count > 0);

    // Recent follow-up activity (from the followUps JSON log)
    const recentFollowUps: any[] = [];
    for (const q of quotations) {
      const fups = (q.followUps as any) || [];
      for (const f of fups) {
        recentFollowUps.push({
          ...f,
          quoteNumber: q.quoteNumber,
          customerName: q.customerName,
        });
      }
    }
    recentFollowUps.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    return NextResponse.json({
      idle: idle.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() })),
      lostByReason,
      lostTotal: lost.length,
      recentFollowUps: recentFollowUps.slice(0, 20),
      lostReasons: LOST_REASONS,
    });
  } catch (error) {
    console.error("GET /api/follow-ups error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
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

    const { id, note, lostReason } = data;
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });
    const quote = await prisma.quotation.findUnique({ where: { id } });
    if (!quote)
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 },
      );

    const fups: any[] = (quote.followUps as any) || [];
    const entry = {
      at: new Date().toISOString(),
      by: user.name || "System",
      note: note || "",
    };

    if (action === "log") {
      if (!note)
        return NextResponse.json({ error: "note required" }, { status: 400 });
      const updated = await prisma.quotation.update({
        where: { id },
        data: { lastFollowUpAt: new Date(), followUps: [...fups, entry] },
      });
      await logAudit({
        actor: user.name || "System",
        action: "FOLLOW_UP_LOGGED",
        entityType: "QUOTATION",
        entityId: id,
        details: `${quote.quoteNumber} — ${note.slice(0, 80)}`,
      });
      return NextResponse.json({ quotation: updated });
    }

    if (action === "mark-lost") {
      if (!lostReason || !LOST_REASONS.includes(lostReason))
        return NextResponse.json(
          { error: "valid lostReason required" },
          { status: 400 },
        );
      const updated = await prisma.quotation.update({
        where: { id },
        data: { status: "LOST", lostReason, followUps: [...fups, entry] },
      });
      await logAudit({
        actor: user.name || "System",
        action: "ENQUIRY_LOST",
        entityType: "QUOTATION",
        entityId: id,
        details: `${quote.quoteNumber} — lost: ${lostReason}${note ? ` (${note.slice(0, 60)})` : ""}`,
      });
      return NextResponse.json({ quotation: updated });
    }

    if (action === "mark-won") {
      // M14 — win reasons feed the conversion funnel.
      const { wonReason } = data;
      if (!wonReason || !LOST_REASONS.includes(wonReason))
        return NextResponse.json(
          { error: "valid wonReason required" },
          { status: 400 },
        );
      // M15 — a quote discounted >5% cannot be closed as won without manager approval.
      if (quote.discountApprovalStatus === "PENDING_MANAGER") {
        return NextResponse.json(
          {
            error:
              "QUOTE_DISCOUNT_PENDING: this quote carries a >5% discount awaiting manager approval.",
          },
          { status: 400 },
        );
      }
      const updated = await prisma.quotation.update({
        where: { id },
        data: { status: "WON", wonReason, followUps: [...fups, entry] },
      });
      await logAudit({
        actor: user.name || "System",
        action: "ENQUIRY_WON",
        entityType: "QUOTATION",
        entityId: id,
        details: `${quote.quoteNumber} — won: ${wonReason}${note ? ` (${note.slice(0, 60)})` : ""}${quote.discountPct > 5 ? ` · discount ${quote.discountPct}%` : ""}`,
      });
      return NextResponse.json({ quotation: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/follow-ups error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
