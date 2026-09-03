import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { daysUntil } from "@/lib/calibration";

export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUISITION_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED"];

/** Instruments due within 30 days (or already expired) that are not yet covered by a live requisition. */
async function findDueInstruments() {
  const tools = await prisma.calibratedTool.findMany({
    where: { lifecycle: { not: "RETIRED" } },
    orderBy: { expiresAt: "asc" },
  });
  const liveReqs = await prisma.calLabRequisition.findMany({
    where: { status: { in: REQUISITION_STATUSES } },
    select: { instruments: true },
  });
  const covered = new Set<string>();
  liveReqs.forEach((r) => {
    ((r.instruments as any[]) || []).forEach((i) => covered.add(i.id));
  });
  return tools
    .filter((t) => daysUntil(t.expiresAt) < 30 && !covered.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      serialNumber: t.serialNumber,
      expiresAt: t.expiresAt,
      costRupees: t.costRupees || null,
      status: t.status,
      daysLeft: daysUntil(t.expiresAt),
    }));
}

function gradeFor(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [requisitions, due, ratings, tools, suppliers] = await Promise.all([
      prisma.calLabRequisition.findMany({
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      findDueInstruments(),
      prisma.calLabVendorRating.findMany({
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: [{ period: "desc" }, { overallScore: "desc" }],
        take: 100,
      }),
      prisma.calibratedTool.count(),
      prisma.supplier.findMany({
        where: { isApproved: true, isActive: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ]);

    const stats = {
      totalTools: tools,
      dueCount: due.length,
      draft: requisitions.filter((r) => r.status === "DRAFT").length,
      submitted: requisitions.filter((r) => r.status === "SUBMITTED").length,
      approved: requisitions.filter((r) => r.status === "APPROVED").length,
      completed: requisitions.filter((r) => r.status === "COMPLETED").length,
    };

    return NextResponse.json({ requisitions, due, ratings, stats, suppliers });
  } catch (error) {
    console.error("GET /api/cal-lab error:", error);
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

    if (action === "scan") {
      // Metrology: auto-draft one requisition for every instrument due < 30 days.
      const due = await findDueInstruments();
      if (due.length === 0) {
        return NextResponse.json({
          success: true,
          created: false,
          message:
            "No instruments due within 30 days — calibration is in window.",
        });
      }
      const seq = await prisma.calLabRequisition.count();
      const req = await prisma.calLabRequisition.create({
        data: {
          reqNumber: `CALLAB-${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`,
          title: `External calibration — ${due.length} instrument(s) due`,
          description: `Auto-generated for instruments expiring within 30 days (or expired). Review, assign a NABL-accredited lab and submit to Supply.`,
          status: "DRAFT",
          source: "CAL_LAB_AUTO",
          instruments: due.map((d) => ({
            id: d.id,
            name: d.name,
            serialNumber: d.serialNumber,
            expiresAt: d.expiresAt,
            costRupees: d.costRupees,
            status: d.status,
            daysLeft: d.daysLeft,
          })),
          estimatedAmount: due.reduce((s, d) => s + (d.costRupees || 1500), 0),
          requestedBy: user.name || "Metrology",
        },
      });
      await logAudit({
        actor: user.name || "Metrology",
        action: "CAL_LAB_REQ_AUTO",
        entityType: "CAL_LAB_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} — ${due.length} instruments due < 30 days (${due.map((d) => d.serialNumber).join(", ")})`,
      });
      return NextResponse.json({
        success: true,
        created: true,
        requisition: req,
        due,
      });
    }

    if (action === "submit") {
      // Metrology sends the draft to Supply.
      const req = await prisma.calLabRequisition.findUnique({
        where: { id: data.id },
      });
      if (!req)
        return NextResponse.json(
          { error: "Requisition not found" },
          { status: 404 },
        );
      if (req.status !== "DRAFT")
        return NextResponse.json(
          { error: "Only DRAFT requisitions can be submitted" },
          { status: 400 },
        );
      const vendor = data.vendorId
        ? await prisma.supplier.findUnique({ where: { id: data.vendorId } })
        : null;
      const updated = await prisma.calLabRequisition.update({
        where: { id: data.id },
        data: {
          status: "SUBMITTED",
          vendorId: vendor?.id || req.vendorId,
          vendorName: vendor?.name || req.vendorName,
          estimatedAmount:
            data.estimatedAmount != null
              ? Number(data.estimatedAmount)
              : req.estimatedAmount,
          targetDate: data.targetDate
            ? new Date(data.targetDate)
            : req.targetDate,
          notes: data.notes || req.notes,
        },
      });
      await logAudit({
        actor: user.name || "Metrology",
        action: "CAL_LAB_REQ_SUBMITTED",
        entityType: "CAL_LAB_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} → Supply${vendor ? ` · ${vendor.name}` : ""} · ₹${updated.estimatedAmount}`,
      });
      return NextResponse.json({ success: true, requisition: updated });
    }

    if (action === "approve" || action === "reject") {
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const req = await prisma.calLabRequisition.findUnique({
        where: { id: data.id },
      });
      if (!req)
        return NextResponse.json(
          { error: "Requisition not found" },
          { status: 404 },
        );
      if (req.status !== "SUBMITTED")
        return NextResponse.json(
          { error: "Only SUBMITTED requisitions can be decided" },
          { status: 400 },
        );
      const updated = await prisma.calLabRequisition.update({
        where: { id: data.id },
        data:
          action === "approve"
            ? {
                status: "APPROVED",
                approvedBy: user.name || "Manager",
                approvedAt: new Date(),
                notes: reason.reason,
              }
            : { status: "REJECTED", rejectionReason: reason.reason },
      });
      await logAudit({
        actor: user.name || "Manager",
        action:
          action === "approve"
            ? "CAL_LAB_REQ_APPROVED"
            : "CAL_LAB_REQ_REJECTED",
        entityType: "CAL_LAB_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} — ${reason.reason}`,
      });
      return NextResponse.json({ success: true, requisition: updated });
    }

    if (action === "complete") {
      // Lab returned the instruments — extend each tool's calibration window.
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const req = await prisma.calLabRequisition.findUnique({
        where: { id: data.id },
      });
      if (!req)
        return NextResponse.json(
          { error: "Requisition not found" },
          { status: 404 },
        );
      if (req.status !== "APPROVED")
        return NextResponse.json(
          { error: "Only APPROVED requisitions can be completed" },
          { status: 400 },
        );

      const instruments = (req.instruments as any[]) || [];
      const newInterval = data.intervalDays ? Number(data.intervalDays) : 365;
      const now = new Date();
      for (const inst of instruments) {
        await prisma.calibratedTool.update({
          where: { id: inst.id },
          data: {
            calibratedAt: now,
            expiresAt: new Date(now.getTime() + newInterval * DAY_MS),
            calibrationIntervalDays: newInterval,
          },
        });
      }

      const updated = await prisma.calLabRequisition.update({
        where: { id: data.id },
        data: { status: "COMPLETED", completedAt: now, notes: reason.reason },
      });
      await logAudit({
        actor: user.name || "Manager",
        action: "CAL_LAB_REQ_COMPLETED",
        entityType: "CAL_LAB_REQUISITION",
        entityId: req.id,
        details: `${req.reqNumber} — ${instruments.length} instrument(s) recalibrated, ${newInterval}-day window (${reason.reason})`,
      });
      return NextResponse.json({ success: true, requisition: updated });
    }

    if (action === "rate") {
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const { vendorId, period, onTimeDelivery, certQuality, notes } = data;
      if (
        !vendorId ||
        !period ||
        onTimeDelivery == null ||
        certQuality == null
      ) {
        return NextResponse.json(
          {
            error: "vendorId, period, onTimeDelivery and certQuality required",
          },
          { status: 400 },
        );
      }
      const otd = Math.min(100, Math.max(0, Number(onTimeDelivery)));
      const certQ = Math.min(100, Math.max(0, Number(certQuality)));
      const overall = Math.round((0.6 * otd + 0.4 * certQ) * 10) / 10;
      const rating = await prisma.calLabVendorRating.upsert({
        where: { vendorId_period: { vendorId, period } },
        update: {
          onTimeDelivery: otd,
          certQuality: certQ,
          overallScore: overall,
          grade: gradeFor(overall),
          notes: notes || reason.reason,
        },
        create: {
          vendorId,
          period,
          onTimeDelivery: otd,
          certQuality: certQ,
          overallScore: overall,
          grade: gradeFor(overall),
          notes: notes || reason.reason,
        },
        include: { vendor: { select: { name: true } } },
      });
      await logAudit({
        actor: user.name || "Manager",
        action: "CAL_LAB_RATED",
        entityType: "CAL_LAB_VENDOR",
        entityId: vendorId,
        details: `${rating.vendor?.name || vendorId} · ${period} · OTD ${otd}% · cert ${certQ}% → ${rating.grade} (${reason.reason})`,
      });
      return NextResponse.json({ success: true, rating });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/cal-lab error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
