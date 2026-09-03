import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSequence } from "@/lib/sequence";
import { autoPostToGL } from "@/lib/glPosting";

export const dynamic = "force-dynamic";

// Category → GL expense account. Fallback = 5140 Administrative Expenses.
const CATEGORY_ACCOUNT: Record<string, string> = {
  TRAVEL: "5120",
  FUEL: "5120",
  FOOD: "5140",
  STATIONERY: "5140",
  MARKETING: "5130",
  REPAIR: "5100",
  UTILITY: "5090",
  QUALITY: "5060",
  TOOLING: "5040",
  SUBCONTRACT: "5030",
  TRAINING: "5140",
  OTHER: "5140",
};

export const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  TRAVEL: { label: "Travel", cls: "bg-sky-500/10 text-sky-400" },
  FUEL: { label: "Fuel", cls: "bg-amber-500/10 text-amber-400" },
  FOOD: { label: "Food & Dining", cls: "bg-orange-500/10 text-orange-400" },
  STATIONERY: { label: "Stationery", cls: "bg-slate-500/10 text-slate-300" },
  MARKETING: { label: "Marketing", cls: "bg-purple-500/10 text-purple-400" },
  REPAIR: { label: "Repairs", cls: "bg-rose-500/10 text-rose-400" },
  UTILITY: { label: "Utilities", cls: "bg-teal-500/10 text-teal-400" },
  QUALITY: { label: "Quality", cls: "bg-emerald-500/10 text-emerald-400" },
  TOOLING: { label: "Tooling", cls: "bg-indigo-500/10 text-indigo-400" },
  SUBCONTRACT: { label: "Subcontract", cls: "bg-cyan-500/10 text-cyan-400" },
  TRAINING: { label: "Training", cls: "bg-lime-500/10 text-lime-400" },
  OTHER: { label: "Other", cls: "bg-slate-500/10 text-slate-400" },
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const claims = await (prisma as any).expenseClaim.findMany({
      include: { items: { orderBy: { createdAt: "asc" } } },
      orderBy: { submittedAt: "desc" },
      take: 200,
    });
    const byStatus = (await (prisma as any).expenseClaim.groupBy({
      by: ["status"],
      _sum: { totalAmount: true },
      _count: { _all: true },
    })) as Array<{ status: string; _sum: { totalAmount: number | null }; _count: { _all: number } }>;
    const statusOf = (s: string) => byStatus.find((b) => b.status === s);
    const now = new Date();
    return NextResponse.json({
      claims,
      stats: {
        openApprovals: (statusOf("SUBMITTED")?._count._all || 0) + (statusOf("APPROVED")?._count._all || 0),
        paidTotal: statusOf("PAID")?._sum.totalAmount || 0,
        approvedOutstanding: statusOf("APPROVED")?._sum.totalAmount || 0,
        monthTotal: claims
          .filter((c: any) => {
            const d = c.expenseDate ? new Date(c.expenseDate) : null;
            return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          })
          .reduce((s: number, c: any) => s + Number(c.totalAmount || 0), 0),
      },
    });
  } catch (error: any) {
    console.error("GET /api/finance/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expense claims" }, { status: 500 });
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
    const action = body.action;
    const data = body.data || {};

    if (action === "create") {
      const { claimantName, claimantCode, expenseDate, notes, items } = data;
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: "At least one expense item required" },
          { status: 400 },
        );
      }
      // Self-submission (ESS): no claimantName → resolve identity from the session
      const isSelf = !data.claimantName || data.self === true;
      let displayName = claimantName ? String(claimantName).slice(0, 200) : "";
      let displayCode = claimantCode ? String(claimantCode).slice(0, 50) : "";
      let claimantUserId: string | null = null;
      if (isSelf) {
        claimantUserId = user.id;
        const u = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true, employeeNumber: true },
        });
        if (u) {
          if (!displayName) displayName = u.name || "Employee";
          if (!displayCode) displayCode = u.employeeNumber || "";
        }
      }
      if (!displayName) {
        return NextResponse.json(
          { error: "claimantName required (or submit as yourself)" },
          { status: 400 },
        );
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
      const total = round2(rows.reduce((s, r) => s + r.amount, 0));
      const claimNumber = await nextSequence("EXP", 4);
      const primary = rows[0].category;
      const claim = await prisma.expenseClaim.create({
        data: {
          claimNumber,
          claimantName: displayName,
          claimantCode: displayCode || null,
          claimantUserId,
          totalAmount: total,
          category: primary,
          expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
          submittedBy: user.name || user.id,
          notes: notes ? String(notes).slice(0, 2000) : null,
          items: {
            create: rows.map((r) => ({
              category: r.category,
              description: r.description,
              amount: r.amount,
              expenseDate: r.expenseDate ? new Date(r.expenseDate) : new Date(),
            })),
          },
        },
        include: { items: true },
      });
      await logAudit({
        actor: user.name || user.id,
        action: "EXPENSE_CLAIM_SUBMITTED",
        entityType: "EXPENSE_CLAIM",
        entityId: claim.id,
        details: `Claim ${claimNumber} (${claimantName}) for ${total} — ${rows.length} item(s)`,
      });
      return NextResponse.json({ success: true, claim }, { status: 201 });
    }

    const mgr = await requireManagerLevel(user);
    if (!mgr.ok) {
      return NextResponse.json({ error: "Manager level required" }, { status: 403 });
    }
    if (action === "approve") {
      const { id, reason } = data;
      const claim = await prisma.expenseClaim.findUnique({ where: { id }, include: { items: true } });
      if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      if (claim.status !== "SUBMITTED") {
        return NextResponse.json({ error: `Claim is ${claim.status} — only SUBMITTED claims can be approved` }, { status: 400 });
      }
      const updated = await prisma.expenseClaim.update({
        where: { id },
        data: { status: "APPROVED", approvedBy: user.name || "System", approvedAt: new Date() },
        include: { items: true },
      });
      await logAudit({
        actor: user.name || "System",
        action: "EXPENSE_CLAIM_APPROVED",
        entityType: "EXPENSE_CLAIM",
        entityId: claim.id,
        details: `${claim.claimNumber} (${claim.claimantName}) ${claim.totalAmount} approved — ${(reason || "").slice(0, 80)}`,
      });
      return NextResponse.json({ claim: updated });
    }

    if (action === "reject") {
      const { id, reason } = data;
      if (!reason || !String(reason).trim()) {
        return NextResponse.json({ error: "Rejection reason required" }, { status: 400 });
      }
      const claim = await prisma.expenseClaim.findUnique({ where: { id } });
      if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      if (claim.status !== "SUBMITTED" && claim.status !== "APPROVED") {
        return NextResponse.json({ error: `Claim is ${claim.status} — cannot reject` }, { status: 400 });
      }
      const updated = await prisma.expenseClaim.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectedBy: user.name || "System",
          rejectedAt: new Date(),
          rejectionReason: String(reason).slice(0, 500),
        },
        include: { items: true },
      });
      await logAudit({
        actor: user.name || "System",
        action: "EXPENSE_CLAIM_REJECTED",
        entityType: "EXPENSE_CLAIM",
        entityId: claim.id,
        details: `${claim.claimNumber} rejected — ${String(reason).slice(0, 80)}`,
      });
      return NextResponse.json({ claim: updated });
    }

    if (action === "pay") {
      const { id, method, reason } = data;
      const claim = await prisma.expenseClaim.findUnique({ where: { id }, include: { items: true } });
      if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      if (claim.status !== "APPROVED") {
        return NextResponse.json({ error: `Claim is ${claim.status} — only APPROVED claims can be paid` }, { status: 400 });
      }
      const total = round2(Number(claim.totalAmount));
      if (total <= 0) return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
      const payMethod = method ? String(method).slice(0, 50) : "Bank";
      const treasury = await prisma.treasuryTransaction.create({
        data: {
          type: "OUTFLOW",
          account: "Main",
          amount: total,
          reference: claim.claimNumber,
          category: "Expense Reimbursement",
          notes: `${claim.claimantName} — ${(reason || "").slice(0, 160)}`,
        },
      });
      const paid = await prisma.expenseClaim.update({
        where: { id },
        data: {
          status: "PAID",
          paidBy: user.name || "System",
          paidAt: new Date(),
          paymentMethod: payMethod,
          treasuryRef: treasury.id,
        },
        include: { items: true },
      });
      await logAudit({
        actor: user.name || "System",
        action: "EXPENSE_CLAIM_PAID",
        entityType: "EXPENSE_CLAIM",
        entityId: claim.id,
        details: `${claim.claimNumber} reimbursed ${total} via ${payMethod}${(reason ? " — " + String(reason).slice(0, 80) : "")}`,
      });

      // GL auto-post: Dr expense account(s) by item category, Cr Bank
      const byAccount = new Map<string, number>();
      for (const it of claim.items) {
        const acc = CATEGORY_ACCOUNT[it.category] || "5140";
        byAccount.set(acc, (byAccount.get(acc) || 0) + Number(it.amount));
      }
      const glLines: any[] = [];
      for (const [acc, amt] of byAccount) {
        if (amt > 0.01)
          glLines.push({ accountCode: acc, debit: round2(amt), reference: claim.claimNumber, narration: `Expense ${claim.claimNumber} — ${claim.claimantName}` });
      }
      glLines.push({ accountCode: "1020", credit: total, reference: claim.claimNumber, narration: `Reimbursement ${claim.claimNumber} via ${payMethod}` });
      await autoPostToGL({
        source: "PAYMENT",
        sourceId: treasury.id,
        memo: `Expense reimbursement ${claim.claimNumber} — ${claim.claimantName}`,
        createdBy: user.name || "System",
        lines: glLines,
      });

      return NextResponse.json({ claim: paid });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/finance/expenses error:", error);
    return NextResponse.json({ error: "Failed to process expense claim" }, { status: 500 });
  }
}
