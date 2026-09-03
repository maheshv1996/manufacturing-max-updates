import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

export const DOC_TYPES = [
  "PROGRESS_REPORT",
  "TEST_CERT",
  "DRAWING",
  "HANDOVER",
  "INVOICE_SUPPORT",
  "OTHER",
];

// M29 — a milestone can only be COMPLETED when every doc in its pack is delivered.
export async function docPackComplete(
  milestone: any,
): Promise<{ ok: boolean; missing: string[] }> {
  const missing = (milestone.docs || [])
    .filter((d: any) => !d.deliveredAt)
    .map((d: any) => d.title);
  return { ok: missing.length === 0, missing };
}

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, [
        "projects.view",
        "projects.edit",
        "exec.view",
        "system.edit",
      ]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const projects = await prisma.project.findMany({
      include: {
        milestones: {
          include: { docs: { orderBy: { createdAt: "asc" } } },
          orderBy: { dueDate: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const enriched = projects.map((p) => {
      const open = p.milestones.filter((m) => m.status !== "COMPLETED");
      return {
        ...p,
        openMilestones: open.length,
        docGaps: open.reduce(
          (n, m) => n + m.docs.filter((d) => !d.deliveredAt).length,
          0,
        ),
        readyToComplete: open.filter((m) => m.docs.every((d) => d.deliveredAt))
          .length,
      };
    });
    return NextResponse.json({ projects: enriched, docTypes: DOC_TYPES });
  } catch (error) {
    console.error("GET /api/milestones error:", error);
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
  const actor = user.name || "Admin";
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
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["projects.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager or projects.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-milestone") {
      const { projectId, name, dueDate } = data;
      if (!projectId || !name || !dueDate)
        return NextResponse.json(
          { error: "projectId, name and dueDate required" },
          { status: 400 },
        );
      result = await prisma.projectMilestone.create({
        data: { projectId, name, dueDate: new Date(dueDate) },
        include: { docs: true },
      });
      await logAudit({
        actor,
        action: "MILESTONE_CREATED",
        entityType: "PROJECT_MILESTONE",
        entityId: result.id,
        details: `${name} · due ${new Date(result.dueDate).toISOString().slice(0, 10)}`,
      });
    } else if (action === "add-doc") {
      const { milestoneId, docType, title, notes } = data;
      if (!milestoneId || !title)
        return NextResponse.json(
          { error: "milestoneId and title required" },
          { status: 400 },
        );
      const m = await prisma.projectMilestone.findUnique({
        where: { id: milestoneId },
      });
      if (!m)
        return NextResponse.json(
          { error: "Milestone not found" },
          { status: 404 },
        );
      if (m.status === "COMPLETED")
        return NextResponse.json(
          { error: "Milestone already completed" },
          { status: 400 },
        );
      result = await prisma.milestoneDoc.create({
        data: {
          milestoneId,
          docType: DOC_TYPES.includes(docType) ? docType : "OTHER",
          title,
          notes: notes || null,
        },
      });
      await logAudit({
        actor,
        action: "MILESTONE_DOC_ADDED",
        entityType: "MILESTONE_DOC",
        entityId: result.id,
        details: `${m.name} · ${result.docType} · ${title}`,
      });
    } else if (action === "deliver-doc") {
      const doc = await prisma.milestoneDoc.findUnique({
        where: { id: data.id },
        include: { milestone: true },
      });
      if (!doc)
        return NextResponse.json({ error: "Doc not found" }, { status: 404 });
      result = await prisma.milestoneDoc.update({
        where: { id: doc.id },
        data: {
          deliveredAt: data.deliveredAt
            ? new Date(data.deliveredAt)
            : new Date(),
          deliveredBy: actor,
          fileRef: data.fileRef !== undefined ? data.fileRef : doc.fileRef,
        },
      });
      await logAudit({
        actor,
        action: "MILESTONE_DOC_DELIVERED",
        entityType: "MILESTONE_DOC",
        entityId: doc.id,
        details: `${doc.milestone.name} · ${doc.title}${result.fileRef ? ` · ${result.fileRef}` : ""}`,
      });
    } else if (action === "complete-milestone") {
      const m = await prisma.projectMilestone.findUnique({
        where: { id: data.id },
        include: { docs: true },
      });
      if (!m)
        return NextResponse.json(
          { error: "Milestone not found" },
          { status: 404 },
        );
      if (m.status === "COMPLETED")
        return NextResponse.json(
          { error: "Already completed" },
          { status: 400 },
        );
      const gate = await docPackComplete(m);
      if (!gate.ok) {
        return NextResponse.json(
          {
            error: `Doc pack incomplete — ${gate.missing.join(", ")}`,
            missing: gate.missing,
          },
          { status: 400 },
        );
      }
      result = await prisma.projectMilestone.update({
        where: { id: m.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completedBy: actor,
        },
        include: { docs: true },
      });
      await logAudit({
        actor,
        action: "MILESTONE_COMPLETED",
        entityType: "PROJECT_MILESTONE",
        entityId: m.id,
        details: `${m.name} · doc pack ${m.docs.length}/${m.docs.length} delivered`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/milestones error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
