import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { nextSequence } from "@/lib/sequence";
import { toPaise, fromPaise, fromPaiseRow, fromPaiseRows } from "@/lib/money";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const claims = await (prisma as any).expenseClaim.findMany({
      where: { claimantUserId: user.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });
    const byStatus = await (prisma as any).expenseClaim.groupBy({
      where: { claimantUserId: user.id },
      by: ["status"],
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    const statusOf = (s: string) => byStatus.find((b: any) => b.status === s);
    // Ledger-style fixed point: rows store paise — expose the rupee contract.
    const claimsRupees = claims.map((c: any) => ({
      ...fromPaiseRow("ExpenseClaim", c),
      items: Array.isArray(c.items) ? fromPaiseRows("ExpenseClaimItem", c.items) : c.items,
    }));
    return NextResponse.json({
      claims: claimsRupees,
      stats: {
        submitted: statusOf("SUBMITTED")?._count._all || 0,
        approved: statusOf("APPROVED")?._count._all || 0,
        paidTotal: fromPaise(statusOf("PAID")?._sum.totalAmount || 0),
        outstanding: fromPaise((statusOf("APPROVED")?._sum.totalAmount || 0) + (statusOf("SUBMITTED")?._sum.totalAmount || 0)),
      },
    });
  } catch (error: any) {
    console.error("GET /api/people/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch my expenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { expenseDate, notes, items } = body.data || {};
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Add at least one expense item" }, { status: 400 });
    }
    const rows: Array<{ category: string; description: string; amount: number; expenseDate?: string }> = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const amount = Number(it.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: `Item ${i + 1}: amount must be positive` }, { status: 400 });
      }
      if (!it.description || !String(it.description).trim()) {
        return NextResponse.json({ error: `Item ${i + 1}: description required` }, { status: 400 });
      }
      rows.push({
        category: String(it.category || "OTHER").toUpperCase(),
        description: String(it.description).trim().slice(0, 300),
        amount: round2(amount),
        expenseDate: it.expenseDate || expenseDate || undefined,
      });
    }

    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, employeeNumber: true },
    });
    const emp = u?.employeeNumber
      ? await prisma.employee.findUnique({ where: { userId: user.id } }).catch(() => null)
      : null;
    const claimantName = u?.name || user.name || "Employee";
    const claimantCode = emp?.employeeNumber || u?.employeeNumber || "";

    const total = round2(rows.reduce((s, r) => s + r.amount, 0));
    const claimNumber = await nextSequence("EXP", 4);
    const claim = await prisma.$transaction(async (tx) => {
      const created = await tx.expenseClaim.create({
        data: {
          claimNumber,
          claimantName,
          claimantCode: claimantCode || null,
          claimantUserId: user.id,
          totalAmount: toPaise(total),
          category: rows[0].category,
          expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
          submittedBy: user.name || user.id,
          notes: notes ? String(notes).slice(0, 2000) : null,
          items: {
            create: rows.map((r) => ({
              category: r.category,
              description: r.description,
              amount: toPaise(r.amount),
              expenseDate: r.expenseDate ? new Date(r.expenseDate) : new Date(),
            })),
          },
        },
        include: { items: true },
      });
      await logAuditTx(tx, {
        actor: user.name || user.id,
        action: "EXPENSE_CLAIM_SUBMITTED",
        entityType: "EXPENSE_CLAIM",
        entityId: created.id,
        details: `Self-service claim ${claimNumber} (${claimantName}) for ${total} — ${rows.length} item(s)`,
      });
      return created;
    });
    return NextResponse.json(
      {
        success: true,
        claim: {
          ...fromPaiseRow("ExpenseClaim", claim),
          items: Array.isArray((claim as any).items)
            ? fromPaiseRows("ExpenseClaimItem", (claim as any).items)
            : (claim as any).items,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("POST /api/people/expenses error:", error);
    return NextResponse.json({ error: "Failed to submit claim" }, { status: 500 });
  }
}
