import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["system.view", "ops.view", "quality.view", "commercial.view"])) {
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
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["system.edit", "ops.edit", "quality.edit", "commercial.edit"])) {
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
    }

    const result = await prisma.$transaction(async (tx) => {
      let res: any;
      if (action === "create") {
        res = await tx.escalation.create({
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
        res = await tx.escalation.update({
          where: { id: data.id },
          data: { status: "ACKNOWLEDGED" },
        });
      } else if (action === "resolve") {
        res = await tx.escalation.update({
          where: { id: data.id },
          data: { status: "RESOLVED" },
        });
      } else if (action === "delete") {
        res = await tx.escalation.delete({ where: { id: data.id } });
      } else {
        throw new Error("INVALID_ACTION");
      }

      await logAuditTx(tx, {
        actor: user.name || "Admin",
        action: `${action.toUpperCase()}_ESCALATION`,
        entityType: "ESCALATION",
        entityId: res?.id || data?.id || "unknown",
        details: `${user.name || "Admin"} ${action} escalation`,
      });

      return res;
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error: any) {
    if (error?.message === "INVALID_ACTION") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    console.error("POST /api/escalations error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
