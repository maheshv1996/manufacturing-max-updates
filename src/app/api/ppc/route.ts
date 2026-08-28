import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function buildReadiness(workOrders: any[]) {
  return Promise.all(
    workOrders.map(async (wo: any) => {
      const rows = (wo.product?.bomLines || []).map((b: any) => {
        const issued = (wo.materialIssueSlips || [])
          .filter((s: any) => s.rawMaterialId === b.rawMaterialId)
          .reduce((s: number, x: any) => s + x.qty, 0);
        const required = (wo.plannedQuantity || 0) * b.qtyPerUnit;
        return {
          sku: b.rawMaterial?.sku,
          name: b.rawMaterial?.name,
          required,
          issued,
          stock: b.rawMaterial?.currentStock || 0,
          shortBy: Math.max(0, required - issued),
          ready: issued >= required,
        };
      });
      const readyAll = rows.length > 0 && rows.every((r: any) => r.ready);
      // no BOM → assume material-ready (tooling/FOR the planner to judge)
      const readiness =
        rows.length === 0 ? "UNKNOWN" : readyAll ? "READY" : "SHORT";
      return { rows, readyAll, readiness };
    }),
  );
}

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user || (!user.isOwner && !can(user, "ops.view"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const wos = await prisma.workOrder.findMany({
      where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
      include: {
        product: { include: { bomLines: { include: { rawMaterial: true } } } },
        materialIssueSlips: { include: { rawMaterial: true } },
      },
      orderBy: [{ priority: "asc" }, { plannedStartDate: "asc" }],
    });

    const readiness = await buildReadiness(wos);

    const board = wos.map((wo: any, i: number) => {
      const r = readiness[i];
      const due = new Date(wo.plannedEndDate);
      const daysLeft = Math.round((due.getTime() - now.getTime()) / 86400000);
      const dueRisk =
        wo.status === "IN_PROGRESS" && wo.plannedEndDate < now
          ? "CRITICAL"
          : wo.plannedEndDate < now
            ? "OVERDUE"
            : daysLeft <= 2
              ? "HIGH"
              : daysLeft <= 7
                ? "MEDIUM"
                : "LOW";
      return {
        id: wo.id,
        woNumber: wo.woNumber,
        status: wo.status,
        product: wo.product?.name || "Product",
        quantity: wo.plannedQuantity,
        customer: wo.customerName || null,
        priority: wo.priority,
        plannedStartDate: wo.plannedStartDate,
        plannedEndDate: wo.plannedEndDate,
        dueRisk,
        daysLeft,
        readiness: r.readiness,
        readyAll: r.readyAll,
        rows: r.rows.slice(0, 3),
      };
    });

    return NextResponse.json({
      board,
      stats: {
        total: board.length,
        ready: board.filter((b) => b.readyAll).length,
        short: board.filter((b) => b.readiness === "SHORT").length,
        critical: board.filter(
          (b) => b.dueRisk === "CRITICAL" || b.dueRisk === "OVERDUE",
        ).length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/ppc error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Admin";
    const user = getUserFromHeaders(headerList);
    if (!user.isOwner && !can(user, "ops.edit")) {
      return NextResponse.json(
        { error: "Insufficient role: ops.edit required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { orderedIds } = body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { error: "orderedIds[] required" },
        { status: 400 },
      );
    }

    // lower priority number = higher on the board; assign 100, 200, …
    const updates = orderedIds.map((id, i) => ({
      id,
      priority: (i + 1) * 100,
    }));
    await Promise.all(
      updates.map((u) =>
        prisma.workOrder.update({
          where: { id: u.id },
          data: { priority: u.priority },
        }),
      ),
    );

    const wos = await prisma.workOrder.findMany({
      where: { id: { in: orderedIds } },
      select: { woNumber: true },
    });
    await logAudit({
      actor,
      action: "WO_RESEQUENCED",
      entityType: "WORK_ORDER",
      entityId: orderedIds.join(","),
      details: `PPC re-sequenced ${orderedIds.length} open work orders: ${wos.map((w) => w.woNumber).join(", ")}`,
    });

    return NextResponse.json({ ok: true, updates });
  } catch (error: any) {
    console.error("POST /api/ppc error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
