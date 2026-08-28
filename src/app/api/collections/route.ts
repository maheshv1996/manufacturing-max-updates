import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { differenceInCalendarDays } from "date-fns";

export const maxDuration = 60;

const BUCKETS = [
  { key: "0-30", label: "0–30 days", min: 0, max: 30 },
  { key: "31-60", label: "31–60 days", min: 31, max: 60 },
  { key: "61-90", label: "61–90 days", min: 61, max: 90 },
  { key: "90+", label: "90+ days", min: 91, max: Infinity },
];

function bucketFor(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const collectorId = searchParams.get("collectorId") || undefined;

    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      include: {
        collectionAccount: {
          include: {
            collector: {
              select: { id: true, name: true, employeeNumber: true },
            },
          },
        },
        payments: true,
      },
      orderBy: { invoiceDate: "asc" },
      take: 300,
    });

    const now = new Date();
    const aged = invoices.map((inv) => {
      const outstanding = Number(inv.totalValue) - Number(inv.paidAmount || 0);
      const base = inv.dueDate
        ? new Date(inv.dueDate)
        : new Date(inv.invoiceDate);
      const days = Math.max(0, differenceInCalendarDays(now, base));
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        invoiceDate: inv.invoiceDate.toISOString(),
        dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
        totalValue: inv.totalValue,
        paidAmount: inv.paidAmount || 0,
        outstanding,
        days,
        bucket: bucketFor(days),
        status: inv.status,
        account: inv.collectionAccount
          ? {
              id: inv.collectionAccount.id,
              dunningLevel: inv.collectionAccount.dunningLevel,
              lastDunningAt: inv.collectionAccount.lastDunningAt,
              followUps: (inv.collectionAccount.followUps as any) || [],
              notes: inv.collectionAccount.notes,
              collector: inv.collectionAccount.collector
                ? {
                    id: inv.collectionAccount.collector.id,
                    name: inv.collectionAccount.collector.name,
                    employeeNumber:
                      inv.collectionAccount.collector.employeeNumber,
                  }
                : null,
            }
          : null,
      };
    });

    const filtered = collectorId
      ? aged.filter((a) => a.account?.collector?.id === collectorId)
      : aged;

    const buckets = BUCKETS.map((b) => {
      const rows = filtered.filter((a) => a.bucket === b.key);
      return {
        ...b,
        count: rows.length,
        outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
      };
    });

    const totalOutstanding = filtered.reduce((s, r) => s + r.outstanding, 0);
    const collectors = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        role: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    return NextResponse.json({
      accounts: filtered,
      buckets,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      collectors,
      stats: {
        unassigned: filtered.filter((a) => !a.account?.collector).length,
        l1: filtered.filter((a) => a.account?.dunningLevel === 1).length,
        l2: filtered.filter((a) => a.account?.dunningLevel === 2).length,
        l3: filtered.filter((a) => a.account?.dunningLevel === 3).length,
      },
    });
  } catch (error) {
    console.error("GET /api/collections error:", error);
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
  if (!(await canAny(user, ["finance.edit", "commercial.edit"])))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    const { id, note, collectorId, level, reason } = data;
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    let account = await prisma.collectionAccount.findUnique({
      where: { invoiceId: id },
    });
    if (!account) {
      account = await prisma.collectionAccount.create({
        data: { invoiceId: id },
      });
    }

    if (action === "assign") {
      if (!collectorId || !validateReason(reason))
        return NextResponse.json(
          { error: "collectorId and reason required" },
          { status: 400 },
        );
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json(
          { error: "Manager level required" },
          { status: 403 },
        );
      const collector = await prisma.user.findUnique({
        where: { id: collectorId },
      });
      if (!collector)
        return NextResponse.json(
          { error: "Collector not found" },
          { status: 404 },
        );
      const updated = await prisma.collectionAccount.update({
        where: { id: account.id },
        data: { collectorId, notes: reason },
      });
      await logAudit({
        actor: user.name || "System",
        action: "COLLECTOR_ASSIGNED",
        entityType: "COLLECTION",
        entityId: account.id,
        details: `${invoice.invoiceNumber} → ${collector.name} (${reason.slice(0, 60)})`,
      });
      return NextResponse.json({ account: updated });
    }

    if (action === "log-followup") {
      if (!note)
        return NextResponse.json({ error: "note required" }, { status: 400 });
      const fups: any[] = (account.followUps as any) || [];
      const updated = await prisma.collectionAccount.update({
        where: { id: account.id },
        data: {
          followUps: [
            ...fups,
            { at: new Date().toISOString(), by: user.name || "System", note },
          ],
        },
      });
      await logAudit({
        actor: user.name || "System",
        action: "COLLECTION_FOLLOWUP",
        entityType: "COLLECTION",
        entityId: account.id,
        details: `${invoice.invoiceNumber} — ${note.slice(0, 70)}`,
      });
      return NextResponse.json({ account: updated });
    }

    if (action === "dunning") {
      const lvl = Number(level);
      if (![1, 2, 3].includes(lvl))
        return NextResponse.json(
          { error: "level must be 1, 2 or 3" },
          { status: 400 },
        );
      if (lvl !== account.dunningLevel + 1)
        return NextResponse.json(
          {
            error: `Dunning must be issued in order — next level is L${account.dunningLevel + 1}`,
          },
          { status: 400 },
        );
      const updated = await prisma.collectionAccount.update({
        where: { id: account.id },
        data: { dunningLevel: lvl, lastDunningAt: new Date() },
      });
      await logAudit({
        actor: user.name || "System",
        action: "DUNNING_ISSUED",
        entityType: "COLLECTION",
        entityId: account.id,
        details: `${invoice.invoiceNumber} — L${lvl} letter issued`,
      });
      return NextResponse.json({ account: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/collections error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
