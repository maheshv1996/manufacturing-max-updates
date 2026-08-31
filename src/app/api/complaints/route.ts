import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { ComplaintType, ComplaintSeverity } from "@prisma/client";
import { computeComplaintSla } from "@/lib/complaintSla";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    if (!can(user, "ops.view") && !can(user, "commercial.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const complaints = await prisma.customerComplaint.findMany({
      orderBy: { raisedAt: "desc" },
      include: {
        workOrder: {
          select: { woNumber: true },
        },
      },
    });

    // M8 — attach SLA timers (24h ack / 10d 8D)
    const now = new Date();
    const enriched = complaints.map((c) => ({
      ...c,
      sla: computeComplaintSla(c, now),
    }));
    return NextResponse.json({
      complaints: enriched,
      slaStats: {
        ackBreached: enriched.filter((c) => c.sla.ackBreached).length,
        eightDBreached: enriched.filter((c) => c.sla.eightDBreached).length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch complaints:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    if (!can(user, "ops.edit") && !can(user, "commercial.edit")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      customerName,
      workOrderId,
      invoiceId,
      batchNo,
      type,
      severity,
      description,
      returnedQty,
    } = body;

    if (!customerName || !type || !severity || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Auto-generate complaint number CMP-YYYY-SEQ
    const year = new Date().getFullYear();
    const count = await prisma.customerComplaint.count({
      where: { complaintNumber: { startsWith: `CMP-${year}-` } },
    });
    const complaintNumber = `CMP-${year}-${String(count + 1).padStart(3, "0")}`;

    const now = new Date();
    const complaint = await prisma.customerComplaint.create({
      data: {
        complaintNumber,
        customerName,
        workOrderId: workOrderId || null,
        invoiceId: invoiceId || null,
        batchNo: batchNo || null,
        type: type as ComplaintType,
        severity: severity as ComplaintSeverity,
        description,
        returnedQty: returnedQty ? parseFloat(returnedQty) : null,
        // M8 — SLA timers: 24h to acknowledge, 10 days to close the 8D
        ackDeadline: new Date(now.getTime() + 24 * 3600000),
        eightDDeadline: new Date(now.getTime() + 10 * 86400000),
      },
    });

    await logAudit({
      actor: user.name || "User",
      action: "COMPLAINT_RAISED",
      entityType: "CustomerComplaint",
      entityId: complaint.id,
      details: JSON.stringify({ complaintNumber, customerName }),
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
