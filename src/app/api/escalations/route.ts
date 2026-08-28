import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["system.view", "ops.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const escalations = await prisma.escalation.findMany({
      orderBy: [{ status: "asc" }, { escalatedAt: "desc" }],
    });

    // Source candidates: anything that could be escalated
    const [openFindings, budgetLines, openNcrs] = await Promise.all([
      prisma.qmsAuditFinding.findMany({
        where: { status: { not: "CLOSED" } },
        include: { audit: { select: { auditNumber: true } } },
      }),
      (prisma as any).budgetLine.findMany(),
      prisma.ncrReport.findMany({
        where: { status: "OPEN" },
        select: {
          id: true,
          ncrNumber: true,
          severity: true,
          description: true,
        },
      }),
    ]);

    const candidates: any[] = [];
    openFindings.forEach((f) =>
      candidates.push({
        sourceType: "AUDIT_FINDING",
        sourceId: f.id,
        title: `Finding ${f.clause} in ${f.audit?.auditNumber || "audit"} — ${f.description.slice(0, 80)}`,
        severity: f.severity,
        dueDate: f.dueDate,
      }),
    );
    budgetLines
      .filter(
        (b: any) =>
          Number(b.spent) > Number(b.allocated) && Number(b.allocated) > 0,
      )
      .forEach((b: any) =>
        candidates.push({
          sourceType: "BUDGET",
          sourceId: `budget-${b.id}`,
          title: `Budget overrun — ${b.department} / ${b.category}`,
          severity: "CRITICAL",
          dueDate: null,
        }),
      );
    openNcrs.forEach((n) =>
      candidates.push({
        sourceType: "NCR",
        sourceId: n.id,
        title: `Open NCR ${n.ncrNumber} — ${n.description?.slice(0, 80) || ""}`,
        severity: n.severity,
        dueDate: null,
      }),
    );

    const escalatedKeys = new Set(
      escalations
        .filter((e) => e.status !== "RESOLVED")
        .map((e) => `${e.sourceType}:${e.sourceId}`),
    );

    return NextResponse.json({
      escalations,
      candidates,
      escalatedKeys: Array.from(escalatedKeys),
    });
  } catch (error) {
    console.error("GET /api/escalations error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["system.edit", "ops.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, data } = body;
    if (!action || !data) {
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    }

    let result: any;

    if (action === "create") {
      if (!data.sourceType || !data.sourceId || !data.title) {
        return NextResponse.json(
          { error: "sourceType, sourceId and title required" },
          { status: 400 },
        );
      }
      const existing = await prisma.escalation.findFirst({
        where: {
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          status: { not: "RESOLVED" },
        },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          record: existing,
          deduped: true,
        });
      }
      result = await prisma.escalation.create({
        data: {
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          title: data.title,
          severity: data.severity || "MEDIUM",
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          notes: data.notes || null,
          escalatedAt: new Date(),
        },
      });
    } else if (action === "ack") {
      result = await prisma.escalation.update({
        where: { id: data.id },
        data: { status: "ACKNOWLEDGED" },
      });
    } else if (action === "resolve") {
      result = await prisma.escalation.update({
        where: { id: data.id },
        data: { status: "RESOLVED" },
      });
    } else if (action === "delete") {
      result = await prisma.escalation.delete({ where: { id: data.id } });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await logAudit({
      actor: user.name || "Admin",
      action: `${action.toUpperCase()}_ESCALATION`,
      entityType: "ESCALATION",
      entityId: result?.id || data?.id || "unknown",
      details: `${user.name || "Admin"} ${action} escalation`,
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/escalations error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
