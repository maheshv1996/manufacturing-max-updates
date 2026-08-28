import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const DOC_TYPES = ["POLICY", "PROCEDURE", "WORK_INSTRUCTION", "FORM", "RECORD"];
const STATUSES = ["CURRENT", "UNDER_REVIEW", "OBSOLETE"];

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user || (!user.isOwner && !can(user, "quality.view"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docs = await prisma.qmsDocument.findMany({
      orderBy: { nextReviewAt: "asc" },
    });
    const now = new Date();
    const enriched = docs.map((d) => {
      const daysLeft = Math.ceil(
        (new Date(d.nextReviewAt).getTime() - now.getTime()) / 86400000,
      );
      return {
        ...d,
        daysLeft,
        overdue: daysLeft <= 0,
        dueSoon: daysLeft > 0 && daysLeft <= 30,
      };
    });

    return NextResponse.json({
      docs: enriched,
      stats: {
        total: docs.length,
        current: docs.filter((d) => d.status === "CURRENT").length,
        underReview: docs.filter((d) => d.status === "UNDER_REVIEW").length,
        overdue: enriched.filter((d) => d.overdue).length,
        dueSoon: enriched.filter((d) => d.dueSoon).length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/qms-docs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Quality Manager";
    const user = getUserFromHeaders(headerList);
    if (!user.isOwner && !can(user, "quality.edit")) {
      return NextResponse.json(
        { error: "Insufficient role: quality.edit required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      id,
      title,
      docType,
      owner,
      revision,
      status,
      nextReviewAt,
      notes,
      approvedAt,
    } = body;

    if (id) {
      // PATCH-style update via POST with id
      const existing = await prisma.qmsDocument.findUnique({ where: { id } });
      if (!existing)
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (title !== undefined) patch.title = title;
      if (docType !== undefined) {
        if (!DOC_TYPES.includes(docType))
          return NextResponse.json(
            { error: `docType must be one of ${DOC_TYPES.join(", ")}` },
            { status: 400 },
          );
        patch.docType = docType;
      }
      if (owner !== undefined) patch.owner = owner;
      if (revision !== undefined) patch.revision = revision;
      if (status !== undefined) {
        if (!STATUSES.includes(status))
          return NextResponse.json(
            { error: `status must be one of ${STATUSES.join(", ")}` },
            { status: 400 },
          );
        patch.status = status;
      }
      if (nextReviewAt !== undefined)
        patch.nextReviewAt = new Date(nextReviewAt);
      if (approvedAt !== undefined)
        patch.approvedAt = approvedAt ? new Date(approvedAt) : null;
      if (notes !== undefined) patch.notes = notes;
      const doc = await prisma.qmsDocument.update({
        where: { id },
        data: patch,
      });
      await logAudit({
        actor,
        action: "QMS_DOC_UPDATED",
        entityType: "QMS_DOCUMENT",
        entityId: doc.id,
        details: `Updated ${doc.docNumber} — ${doc.title} (rev ${doc.revision}, ${doc.status})`,
      });
      return NextResponse.json({ success: true, item: doc });
    }

    // Create
    const {
      title: t,
      docType: dt,
      owner: o,
      revision: r,
      status: s,
      nextReviewAt: nr,
      notes: n,
    } = body;
    if (!t || !nr)
      return NextResponse.json(
        { error: "title and nextReviewAt required" },
        { status: 400 },
      );
    if (dt && !DOC_TYPES.includes(dt))
      return NextResponse.json(
        { error: `docType must be one of ${DOC_TYPES.join(", ")}` },
        { status: 400 },
      );
    if (s && !STATUSES.includes(s))
      return NextResponse.json(
        { error: `status must be one of ${STATUSES.join(", ")}` },
        { status: 400 },
      );

    const year = new Date().getFullYear();
    const count = await prisma.qmsDocument.count({
      where: { docNumber: { startsWith: `QMS-${year}-` } },
    });
    const docNumber = `QMS-${year}-${String(count + 1).padStart(3, "0")}`;
    const doc = await prisma.qmsDocument.create({
      data: {
        docNumber,
        title: t,
        docType: dt || "PROCEDURE",
        owner: o || "Quality Manager",
        revision: r || "A",
        status: s || "CURRENT",
        approvedAt: approvedAt ? new Date(approvedAt) : new Date(),
        nextReviewAt: new Date(nr),
        notes: n || null,
      },
    });
    await logAudit({
      actor,
      action: "QMS_DOC_CREATED",
      entityType: "QMS_DOCUMENT",
      entityId: doc.id,
      details: `Created ${docNumber} — ${t} (next review ${new Date(nr).toISOString().slice(0, 10)})`,
    });
    return NextResponse.json({ success: true, item: doc }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/qms-docs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
