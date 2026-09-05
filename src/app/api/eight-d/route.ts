import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const EIGHT_D_FIELDS = [
  "title",
  "problemDescription",
  "severity",
  "teamMembers",
  "problemStatement",
  "containmentAction",
  "containmentOwner",
  "containmentDue",
  "why1",
  "why2",
  "why3",
  "why4",
  "why5",
  "rootCauseSummary",
  "correctiveAction",
  "correctiveOwner",
  "correctiveDue",
  "preventiveAction",
  "preventiveOwner",
  "preventiveDue",
  "verificationMethod",
  "verifiedBy",
  "effectivenessScore",
  "closureSummary",
];

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reports = await prisma.eightDReport.findMany({
      include: {
        ncr: { select: { ncrNumber: true, status: true } },
        workOrder: { select: { woNumber: true } },
        product: { select: { sku: true, name: true } },
        actions: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { raisedAt: "desc" },
    });
    const ncrs = await prisma.ncrReport.findMany({
      where: { status: { not: "CLOSED" } },
      select: { id: true, ncrNumber: true, description: true, status: true },
      orderBy: { raisedAt: "desc" },
    });
    const products = await prisma.product.findMany({
      select: { id: true, sku: true, name: true },
      orderBy: { sku: "asc" },
    });
    return NextResponse.json({ items: reports, ncrs, products });
  } catch (error: any) {
    console.error("GET /api/eight-d error:", error);
    return NextResponse.json(
      { error: "Failed to fetch 8D reports" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !can(user, "quality.edit") &&
      !can(user, "ops.edit") &&
      !can(user, "system.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const userName = user.name || headerList.get("x-user-name") || "Quality Lead";

    // entity: report | action
    if (body.entity === "action") {
      const { reportId, type, description, owner, dueDate, status, notes } =
        body.data || {};
      if (!reportId || !description) {
        return NextResponse.json(
          { error: "reportId and description are required" },
          { status: 400 },
        );
      }

      const action = await prisma.$transaction(async (tx) => {
        const act = await tx.capaAction.create({
          data: {
            reportId,
            type: type || "CORRECTIVE",
            description,
            owner: owner || null,
            dueDate: dueDate ? new Date(dueDate) : null,
            status: status || "OPEN",
            notes: notes || null,
          },
        });
        await logAuditTx(tx, {
          actor: userName,
          action: "CAPA_ACTION_ADDED",
          entityType: "EIGHT_D",
          entityId: reportId,
          details: `Added ${act.type} action: ${description.slice(0, 80)}`,
        });
        return act;
      });

      return NextResponse.json({ success: true, item: action });
    }

    if (body.entity === "actionStatus") {
      const { id, status, verifiedBy } = body.data || {};
      if (!id)
        return NextResponse.json({ error: "id required" }, { status: 400 });

      const action = await prisma.$transaction(async (tx) => {
        const act = await tx.capaAction.update({
          where: { id },
          data: {
            status,
            verifiedBy: status === "VERIFIED" ? verifiedBy || userName : null,
            verifiedAt: status === "VERIFIED" ? new Date() : null,
          },
        });
        await logAuditTx(tx, {
          actor: userName,
          action: "CAPA_ACTION_STATUS_CHANGED",
          entityType: "EIGHT_D",
          entityId: act.reportId,
          details: `CAPA Action ${id} status → ${status}${status === "VERIFIED" ? ` (verified by ${verifiedBy || userName})` : ""}`,
        });
        return act;
      });

      return NextResponse.json({ success: true, item: action });
    }

    // Default: report create/update
    const { id, ncrId, complaintId, workOrderId, productId, status, ...rest } =
      body.data || {};

    if (id) {
      const patch: any = {};
      for (const f of EIGHT_D_FIELDS) {
        if (rest[f] !== undefined) patch[f] = rest[f] === "" ? null : rest[f];
      }
      for (const f of [
        "containmentDue",
        "correctiveDue",
        "preventiveDue",
        "verifiedAt",
      ]) {
        if (rest[f] !== undefined)
          patch[f] = rest[f] ? new Date(rest[f]) : null;
      }
      if (
        rest.effectivenessScore !== undefined &&
        rest.effectivenessScore !== ""
      ) {
        patch.effectivenessScore = Number(rest.effectivenessScore);
      }
      if (status) {
        patch.status = status;
        if (status === "D7_VERIFY") patch.verifiedAt = new Date();
        if (status === "D8_CLOSURE")
          patch.closureSummary =
            patch.closureSummary || rest.closureSummary || null;
        if (status === "CLOSED") {
          patch.closedAt = new Date();
        }
      }

      const report = await prisma.$transaction(async (tx) => {
        if (patch.status === "CLOSED") {
          // Close linked NCR atomically too
          const rep = await tx.eightDReport.findUnique({ where: { id } });
          if (rep?.ncrId) {
            await tx.ncrReport.update({
              where: { id: rep.ncrId },
              data: { status: "CLOSED", closedAt: new Date() },
            });
          }
        }

        const rep = await tx.eightDReport.update({
          where: { id },
          data: patch,
        });

        await logAuditTx(tx, {
          actor: userName,
          action: "EIGHT_D_UPDATED",
          entityType: "EIGHT_D",
          entityId: rep.id,
          details: `Updated 8D ${rep.reportNumber} (status ${patch.status || "unchanged"})`,
        });

        return rep;
      });

      return NextResponse.json({ success: true, item: report });
    }

    // Create
    const report = await prisma.$transaction(async (tx) => {
      const count = await tx.eightDReport.count();
      const reportNumber = `8D-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;
      const data: any = {
        reportNumber,
        ncrId: ncrId || null,
        complaintId: complaintId || null,
        workOrderId: workOrderId || null,
        productId: productId || null,
        title: rest.title || "8D Report",
        severity: rest.severity || "MEDIUM",
        status: status || "D1_TEAM",
        raisedBy: userName,
      };
      for (const f of EIGHT_D_FIELDS) {
        if (rest[f] !== undefined && rest[f] !== "") data[f] = rest[f];
      }
      for (const f of ["containmentDue", "correctiveDue", "preventiveDue"]) {
        if (rest[f]) data[f] = new Date(rest[f]);
      }

      const rep = await tx.eightDReport.create({ data });

      // Auto-create the three default CAPA actions atomically
      const defaultActions = [
        {
          type: "CONTAINMENT" as const,
          description: "Contain the problem (protect customer / downstream)",
        },
        { type: "CORRECTIVE" as const, description: "Correct the root cause" },
        {
          type: "PREVENTIVE" as const,
          description: "Prevent recurrence across the system",
        },
      ];
      for (const a of defaultActions) {
        await tx.capaAction.create({
          data: { reportId: rep.id, type: a.type, description: a.description },
        });
      }

      await logAuditTx(tx, {
        actor: userName,
        action: "EIGHT_D_CREATED",
        entityType: "EIGHT_D",
        entityId: rep.id,
        details: `Created 8D ${reportNumber} — ${rep.title}`,
      });

      return rep;
    });

    return NextResponse.json({ success: true, item: report });
  } catch (error: any) {
    console.error("POST /api/eight-d error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
