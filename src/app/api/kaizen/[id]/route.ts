import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const project = await prisma.improvementProject.findUnique({
      where: { id },
      include: {
        machine: { select: { name: true, code: true } },
        rcaRecord: true,
        actionItems: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!project)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    console.error("GET /api/kaizen/[id] error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;
    const actor = user.name || user.id || "Operator";

    if (action === "UPDATE_PHASE") {
      const { phase, status } = body;
      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.improvementProject.update({
          where: { id },
          data: {
            phase,
            status: status || undefined,
            completedAt: status === "COMPLETED" ? new Date() : undefined,
          },
          include: {
            machine: { select: { name: true, code: true } },
            rcaRecord: true,
            actionItems: true,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "KAIZEN_PHASE_UPDATED",
          entityType: "ImprovementProject",
          entityId: id,
          details: `phase → ${phase}${status ? " · status=" + status : ""}`,
        });

        return res;
      });

      return NextResponse.json(updated);
    }

    if (action === "UPDATE_STATUS") {
      const { status } = body;
      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.improvementProject.update({
          where: { id },
          data: {
            status,
            completedAt: status === "COMPLETED" ? new Date() : undefined,
          },
          include: {
            machine: { select: { name: true, code: true } },
            rcaRecord: true,
            actionItems: true,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "KAIZEN_STATUS_UPDATED",
          entityType: "ImprovementProject",
          entityId: id,
          details: `status → ${status}`,
        });

        return res;
      });

      return NextResponse.json(updated);
    }

    if (action === "SAVE_RCA") {
      const {
        problemStatement,
        why1,
        why2,
        why3,
        why4,
        why5,
        rootCause,
        fishboneCategory,
      } = body;

      const rca = await prisma.$transaction(async (tx) => {
        const res = await tx.rcaRecord.upsert({
          where: { projectId: id },
          update: {
            problemStatement,
            why1,
            why2,
            why3,
            why4,
            why5,
            rootCause,
            fishboneCategory: fishboneCategory || null,
          },
          create: {
            projectId: id,
            problemStatement,
            why1,
            why2,
            why3,
            why4,
            why5,
            rootCause,
            fishboneCategory: fishboneCategory || null,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "KAIZEN_RCA_SAVED",
          entityType: "RcaRecord",
          entityId: res.id,
          details: `project ${id} · ${rootCause ? "rootCause set" : "cleared"}`,
        });

        return res;
      });

      return NextResponse.json(rca);
    }

    if (action === "ADD_ACTION_ITEM") {
      const { description, ownerName, dueDate } = body;
      if (!description || !ownerName || !dueDate) {
        return NextResponse.json(
          { error: "description, ownerName, dueDate required" },
          { status: 400 },
        );
      }

      const item = await prisma.$transaction(async (tx) => {
        const res = await tx.actionItem.create({
          data: {
            projectId: id,
            description,
            ownerName,
            dueDate: new Date(dueDate),
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "KAIZEN_ACTION_ITEM_ADDED",
          entityType: "ActionItem",
          entityId: res.id,
          details: `project ${id} · ${description.slice(0, 80)}`,
        });

        return res;
      });

      return NextResponse.json(item);
    }

    if (action === "TOGGLE_ACTION_ITEM") {
      const { itemId, status } = body;
      const item = await prisma.$transaction(async (tx) => {
        const res = await tx.actionItem.update({
          where: { id: itemId },
          data: { status },
        });

        await logAuditTx(tx, {
          actor,
          action: "KAIZEN_ACTION_ITEM_TOGGLED",
          entityType: "ActionItem",
          entityId: itemId,
          details: `status → ${status}`,
        });

        return res;
      });

      return NextResponse.json(item);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/kaizen/[id] error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
