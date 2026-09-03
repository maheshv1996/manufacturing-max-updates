import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["commercial.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [entries, treasury] = await Promise.all([
      prisma.bankStatementEntry.findMany({
        orderBy: { date: "desc" },
        include: {
          matchedTreasury: {
            select: {
              id: true,
              reference: true,
              category: true,
              amount: true,
              type: true,
            },
          },
        },
        take: 500,
      }),
      prisma.treasuryTransaction.findMany({
        orderBy: { date: "desc" },
        take: 300,
      }),
    ]);

    const total = entries.length;
    const matched = entries.filter((e) => e.matchStatus !== "UNMATCHED").length;

    return NextResponse.json({
      entries,
      treasury,
      summary: {
        total,
        matched,
        unmatched: total - matched,
        autoMatched: entries.filter((e) => e.matchStatus === "MATCHED").length,
        manualMatched: entries.filter((e) => e.matchStatus === "MANUAL").length,
      },
    });
  } catch (error) {
    console.error("GET /api/bank-reconcile error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["commercial.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data) {
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    }

    let result: any;

    if (action === "upload") {
      const rows: {
        date: string;
        description: string;
        amount: number;
        balanceAfter?: number;
      }[] = data.rows || [];
      if (!rows.length)
        return NextResponse.json(
          { error: "No rows provided" },
          { status: 400 },
        );
      const batch = `BATCH-${Date.now()}`;
      const unmatchedTreasury = await prisma.treasuryTransaction.findMany({
        where: { bankMatches: { none: {} } },
        select: { id: true, date: true, amount: true },
      });

      let autoMatched = 0;
      for (const row of rows) {
        const date = new Date(row.date);
        const amount = Number(row.amount) || 0;
        if (isNaN(date.getTime()) || amount === 0) continue;

        const match = unmatchedTreasury.find(
          (t) =>
            Math.abs(Math.abs(t.amount) - Math.abs(amount)) < 0.01 &&
            new Date(t.date).toDateString() === date.toDateString(),
        );

        if (match) {
          await prisma.bankStatementEntry.create({
            data: {
              date,
              description: String(row.description || ""),
              amount,
              balanceAfter:
                row.balanceAfter != null ? Number(row.balanceAfter) : null,
              matchedTreasuryId: match.id,
              matchStatus: "MATCHED",
              uploadBatch: batch,
            },
          });
          autoMatched++;
        } else {
          await prisma.bankStatementEntry.create({
            data: {
              date,
              description: String(row.description || ""),
              amount,
              balanceAfter:
                row.balanceAfter != null ? Number(row.balanceAfter) : null,
              matchStatus: "UNMATCHED",
              uploadBatch: batch,
            },
          });
        }
      }
      result = { batch, imported: rows.length, autoMatched };
    } else if (action === "match") {
      if (!data.entryId || !data.treasuryId) {
        return NextResponse.json(
          { error: "entryId and treasuryId required" },
          { status: 400 },
        );
      }
      result = await prisma.bankStatementEntry.update({
        where: { id: data.entryId },
        data: { matchedTreasuryId: data.treasuryId, matchStatus: "MANUAL" },
      });
    } else if (action === "unmatch") {
      result = await prisma.bankStatementEntry.update({
        where: { id: data.entryId },
        data: { matchedTreasuryId: null, matchStatus: "UNMATCHED" },
      });
    } else if (action === "deleteEntry") {
      result = await prisma.bankStatementEntry.delete({
        where: { id: data.entryId },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await logAudit({
      actor: user.name || "Admin",
      action: `${action.toUpperCase()}_BANK_RECONCILE`,
      entityType: "BANK_RECONCILE",
      entityId: result?.id || result?.batch || data?.entryId || "unknown",
      details: `${user.name || "Admin"} ${action} on bank reconciliation`,
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/bank-reconcile error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
