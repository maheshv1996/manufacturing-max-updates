import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { matchDepartmentKey } from "@/lib/departments";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const dept = searchParams.get("dept");

    const lines = await prisma.budgetLine.findMany({
      orderBy: { department: "asc" },
    });

    const byDept = new Map<string, typeof lines>();
    for (const l of lines) {
      const key = matchDepartmentKey(l.department) || l.department;
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(l);
    }

    const rows = lines.map((l) => {
      const allocated = Number(l.allocated) || 0;
      const spent = Number(l.spent) || 0;
      const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      return {
        ...l,
        deptKey: matchDepartmentKey(l.department) || l.department,
        burnPct: pct,
        overrun: allocated > 0 && spent > allocated,
        remaining: Math.max(0, allocated - spent),
      };
    });

    const totals = new Map<
      string,
      { allocated: number; spent: number; lines: number }
    >();
    for (const r of rows) {
      const t = totals.get(r.deptKey) || { allocated: 0, spent: 0, lines: 0 };
      t.allocated += r.allocated;
      t.spent += r.spent;
      t.lines += 1;
      totals.set(r.deptKey, t);
    }
    const summary = [...totals.entries()].map(([deptKey, t]) => ({
      deptKey,
      allocated: t.allocated,
      spent: t.spent,
      lines: t.lines,
      burnPct: t.allocated > 0 ? Math.round((t.spent / t.allocated) * 100) : 0,
      overrun: t.allocated > 0 && t.spent > t.allocated,
    }));

    let filtered = rows;
    if (dept) {
      filtered = rows.filter((r) => r.deptKey === dept);
    }

    return NextResponse.json({ rows: filtered, summary, allRows: rows });
  } catch (error) {
    console.error("GET /api/cost-centers error:", error);
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
  if (!(await canAny(user, ["finance.edit", "exec.edit"])))
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

    if (action === "update-spend") {
      const { id, spent, notes } = data;
      const amt = Number(spent);
      if (!id || !(amt >= 0))
        return NextResponse.json(
          { error: "id and spent (>= 0) required" },
          { status: 400 },
        );
      const line = await prisma.budgetLine.update({
        where: { id },
        data: { spent: amt, notes: notes || undefined },
      });

      await logAudit({
        actor: user.name || "system",
        action: "BUDGET_SPEND_UPDATED",
        entityType: "BudgetLine",
        entityId: id,
        details: `spent=${amt}`,
      });

      return NextResponse.json({ line });
    }

    if (action === "create") {
      const { fiscalYear, department, category, allocated, notes } = data;
      const amt = Number(allocated);
      if (!fiscalYear || !department || !category || !(amt >= 0))
        return NextResponse.json(
          { error: "fiscalYear, department, category, allocated required" },
          { status: 400 },
        );
      const line = await prisma.budgetLine.create({
        data: {
          fiscalYear,
          department,
          category,
          allocated: amt,
          spent: 0,
          notes: notes || null,
        },
      });

      await logAudit({
        actor: user.name || "system",
        action: "BUDGET_LINE_CREATED",
        entityType: "BudgetLine",
        entityId: line.id,
        details: `${fiscalYear} · ${department} · ${category} · ${amt}`,
      });

      return NextResponse.json({ line }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/cost-centers error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
