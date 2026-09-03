import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [requisitions, users, overduePos] = await Promise.all([
      prisma.purchaseRequisition.findMany({
        include: {
          assignedTo: {
            select: { id: true, name: true, employeeNumber: true },
          },
          followUps: { orderBy: { at: "desc" }, take: 6 },
        },
        orderBy: [{ urgency: "asc" }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, employeeNumber: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
      prisma.purchaseOrder.findMany({
        where: {
          status: { in: ["ORDERED", "PARTIAL"] },
          expectedDate: { lt: new Date() },
        },
        include: { supplier: true },
        orderBy: { expectedDate: "asc" },
        take: 50,
      }),
    ]);
    const stats = {
      open: requisitions.filter((r) => r.status === "OPEN").length,
      assigned: requisitions.filter(
        (r) => r.status === "ASSIGNED" || r.status === "IN_PROGRESS",
      ).length,
      poIssued: requisitions.filter((r) => r.status === "PO_ISSUED").length,
      overduePo: overduePos.length,
      critical: requisitions.filter(
        (r) =>
          r.urgency === "CRITICAL" &&
          r.status !== "PO_ISSUED" &&
          r.status !== "CANCELLED",
      ).length,
    };
    return NextResponse.json({ requisitions, users, overduePos, stats });
  } catch (error) {
    console.error("GET /api/buyer-board error:", error);
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

    if (action === "create") {
      const {
        title,
        itemName,
        qty,
        unit,
        estimatedCost,
        urgency,
        description,
      } = data;
      if (!title)
        return NextResponse.json({ error: "title required" }, { status: 400 });
      const seq = await prisma.purchaseRequisition.count();
      const req = await prisma.purchaseRequisition.create({
        data: {
          reqNumber: `PR-${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`,
          title,
          description: description || null,
          itemName: itemName || null,
          qty: qty != null ? Number(qty) : null,
          unit: unit || null,
          estimatedCost: estimatedCost != null ? Number(estimatedCost) : null,
          urgency: urgency || "NORMAL",
          requestedBy: user.name || "Stores",
        },
      });
      await logAudit({
        actor: user.name || "Stores",
        action: "REQ_CREATED",
        entityType: "PURCHASE_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} — ${title}`,
      });
      return NextResponse.json(
        { success: true, requisition: req },
        { status: 201 },
      );
    }

    if (action === "assign") {
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const req = await prisma.purchaseRequisition.findUnique({
        where: { id: data.id },
      });
      if (!req)
        return NextResponse.json(
          { error: "Requisition not found" },
          { status: 404 },
        );
      if (req.status !== "OPEN")
        return NextResponse.json(
          { error: "Only OPEN requisitions can be assigned" },
          { status: 400 },
        );
      if (!data.buyerId)
        return NextResponse.json(
          { error: "buyerId required" },
          { status: 400 },
        );
      const buyer = await prisma.user.findUnique({
        where: { id: data.buyerId },
        select: { name: true },
      });
      const updated = await prisma.purchaseRequisition.update({
        where: { id: data.id },
        data: {
          assignedToId: data.buyerId,
          assignedByName: buyer?.name || "Buyer",
          assignedAt: new Date(),
          status: "ASSIGNED",
          description: reason.reason,
        },
      });
      await logAudit({
        actor: user.name || "Manager",
        action: "REQ_ASSIGNED",
        entityType: "PURCHASE_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} → ${buyer?.name || data.buyerId} (${reason.reason})`,
      });
      return NextResponse.json({ success: true, requisition: updated });
    }

    if (action === "followUp") {
      const { id, note } = data;
      if (!id || !note || !note.trim())
        return NextResponse.json(
          { error: "id and note required" },
          { status: 400 },
        );
      const req = await prisma.purchaseRequisition.findUnique({
        where: { id },
      });
      if (!req)
        return NextResponse.json(
          { error: "Requisition not found" },
          { status: 404 },
        );
      const log = await prisma.poFollowUpLog.create({
        data: {
          requisitionId: id,
          note: note.trim(),
          by: user.name || "Buyer",
        },
      });
      await prisma.purchaseRequisition.update({
        where: { id },
        data: {
          status: req.status === "ASSIGNED" ? "IN_PROGRESS" : req.status,
        },
      });
      await logAudit({
        actor: user.name || "Buyer",
        action: "PO_FOLLOW_UP",
        entityType: "PURCHASE_REQUISITION",
        entityId: id,
        details: `${req.reqNumber} — ${note.trim().slice(0, 100)}`,
      });
      return NextResponse.json({ success: true, followUp: log });
    }

    if (action === "issuePo") {
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const req = await prisma.purchaseRequisition.findUnique({
        where: { id: data.id },
      });
      if (!req)
        return NextResponse.json(
          { error: "Requisition not found" },
          { status: 404 },
        );
      if (!data.poNumber)
        return NextResponse.json(
          { error: "poNumber required" },
          { status: 400 },
        );
      const updated = await prisma.purchaseRequisition.update({
        where: { id: data.id },
        data: {
          status: "PO_ISSUED",
          poNumber: data.poNumber,
          description: reason.reason,
        },
      });
      await logAudit({
        actor: user.name || "Manager",
        action: "REQ_PO_ISSUED",
        entityType: "PURCHASE_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} → ${data.poNumber} (${reason.reason})`,
      });
      return NextResponse.json({ success: true, requisition: updated });
    }

    if (action === "cancel") {
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const req = await prisma.purchaseRequisition.findUnique({
        where: { id: data.id },
      });
      if (!req)
        return NextResponse.json(
          { error: "Requisition not found" },
          { status: 404 },
        );
      if (req.status === "PO_ISSUED")
        return NextResponse.json(
          { error: "PO already issued — cancel the PO instead" },
          { status: 400 },
        );
      const updated = await prisma.purchaseRequisition.update({
        where: { id: data.id },
        data: { status: "CANCELLED", description: reason.reason },
      });
      await logAudit({
        actor: user.name || "Manager",
        action: "REQ_CANCELLED",
        entityType: "PURCHASE_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} — ${reason.reason}`,
      });
      return NextResponse.json({ success: true, requisition: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/buyer-board error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
