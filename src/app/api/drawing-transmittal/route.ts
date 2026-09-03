import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";

export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !user.isOwner &&
    !canAny(user, [
      "engineering.view",
      "ops.view",
      "quality.view",
      "system.view",
    ])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const transmittals = await prisma.drawingTransmittal.findMany({
      include: {
        document: {
          include: {
            product: { select: { sku: true, name: true } },
            operation: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { releasedAt: "desc" },
    });
    const documents = await prisma.document.findMany({
      where: { status: "CURRENT" },
      include: {
        product: { select: { sku: true, name: true } },
        operation: { select: { code: true, name: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });
    return NextResponse.json({ transmittals, documents });
  } catch (error) {
    console.error("GET /api/drawing-transmittal error:", error);
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
    let result: any;

    if (action === "release") {
      // Releasing a drawing revision is an engineering-management decision.
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      if (!canAny(user, ["engineering.edit", "system.edit"]) && !user.isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const doc = await prisma.document.findUnique({
        where: { id: data.documentId },
      });
      if (!doc)
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      const existing = await prisma.drawingTransmittal.findUnique({
        where: {
          documentId_revision: { documentId: doc.id, revision: doc.version },
        },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          record: existing,
          deduped: true,
        });
      }
      result = await prisma.drawingTransmittal.create({
        data: {
          documentId: doc.id,
          revision: doc.version,
          releasedBy: user.name || "Engineering",
        },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "DRAWING_RELEASED",
        entityType: "DOCUMENT",
        entityId: doc.id,
        details: `${doc.title} rev ${doc.version} released — awaiting Production + Quality acknowledgement`,
      });
    } else if (action === "ack") {
      // Acknowledging a revision is a department-head decision for that function.
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const role = data.role;
      if (!["PRODUCTION", "QUALITY"].includes(role)) {
        return NextResponse.json(
          { error: "role must be PRODUCTION or QUALITY" },
          { status: 400 },
        );
      }
      const t = await prisma.drawingTransmittal.findUnique({
        where: { id: data.transmittalId },
      });
      if (!t)
        return NextResponse.json(
          { error: "Transmittal not found" },
          { status: 404 },
        );
      const field =
        role === "PRODUCTION"
          ? {
              ackProduction: true,
              ackProductionBy: user.name || "Production Manager",
              ackProductionAt: new Date(),
            }
          : {
              ackQuality: true,
              ackQualityBy: user.name || "Quality Manager",
              ackQualityAt: new Date(),
            };
      result = await prisma.drawingTransmittal.update({
        where: { id: t.id },
        data: field,
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "DRAWING_ACK",
        entityType: "DOCUMENT",
        entityId: t.documentId,
        details: `${role} acknowledged drawing rev ${t.revision} (${reason.reason})`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/drawing-transmittal error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
