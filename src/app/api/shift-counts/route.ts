import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import {
  requireManagerLevel,
  validateReason,
  auditDecision,
} from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId");
    const status = searchParams.get("status");

    const where: any = {};
    if (machineId) where.machineId = machineId;
    if (status) where.status = status;

    const counts = await (prisma as any).shiftCount.findMany({
      where,
      include: {
        machine: true,
        fromShift: true,
        toShift: true,
        outgoingUser: true,
        incomingUser: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(counts);
  } catch (error: any) {
    console.error("Fetch shift counts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift counts" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      machineId,
      fromShiftId,
      toShiftId,
      operatorId,
      outCount,
      inCount,
      countId,
      note,
    } = body;

    // OUTGOING SHIFT COUNT
    if (action === "OUTGOING") {
      if (!machineId || !fromShiftId || !operatorId || outCount === undefined) {
        return NextResponse.json(
          { error: "Missing required fields for outgoing count" },
          { status: 400 },
        );
      }

      const newCount = await (prisma as any).shiftCount.create({
        data: {
          machineId,
          fromShiftId,
          toShiftId: toShiftId || null,
          outgoingUserId: operatorId,
          outCount: parseInt(outCount, 10),
          status: "PENDING",
        },
        include: {
          machine: true,
          fromShift: true,
          outgoingUser: true,
        },
      });

      await logAudit({
        actor: "system",
        action: "SHIFT_COUNT_OUTGOING_CREATED",
        entityType: "ShiftCount",
        entityId: newCount.id,
        details: `Outgoing count of ${outCount} units recorded for machine ${machineId}`,
      });

      return NextResponse.json(newCount);
    }

    // INCOMING SHIFT COUNT VERIFICATION
    if (action === "INCOMING") {
      if (!countId || !operatorId || inCount === undefined) {
        return NextResponse.json(
          { error: "Missing countId, operatorId or inCount" },
          { status: 400 },
        );
      }

      const existingCount = await (prisma as any).shiftCount.findUnique({
        where: { id: countId },
      });

      if (!existingCount) {
        return NextResponse.json(
          { error: "Shift count log not found" },
          { status: 404 },
        );
      }

      // Fetch count tolerance setting
      const toleranceSetting = await (prisma as any).setting.findUnique({
        where: { key: "count_tolerance" },
      });
      const tolerance = toleranceSetting
        ? parseInt(toleranceSetting.value, 10)
        : 0;

      const parsedInCount = parseInt(inCount, 10);
      const diff = Math.abs(existingCount.outCount - parsedInCount);
      const isWithinTolerance = diff <= tolerance;

      const status = isWithinTolerance ? "AGREED" : "DISPUTED";
      const finalCount = isWithinTolerance ? parsedInCount : null;
      const disputeNote = isWithinTolerance
        ? null
        : note ||
          `Discrepancy flagged: Outgoing ${existingCount.outCount} vs Incoming ${parsedInCount} (Delta: ${diff})`;

      const updatedCount = await (prisma as any).shiftCount.update({
        where: { id: countId },
        data: {
          incomingUserId: operatorId,
          toShiftId: toShiftId || existingCount.toShiftId,
          inCount: parsedInCount,
          finalCount,
          status,
          note: disputeNote,
        },
        include: {
          machine: true,
          fromShift: true,
          toShift: true,
          outgoingUser: true,
          incomingUser: true,
        },
      });

      await logAudit({
        actor: "system",
        action: "SHIFT_COUNT_INCOMING_VERIFIED",
        entityType: "ShiftCount",
        entityId: countId,
        details: `outCount=${existingCount.outCount} · inCount=${parsedInCount} · tolerance=${tolerance} · status=${status}`,
      });

      return NextResponse.json(updatedCount);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Save shift count error:", error);
    return NextResponse.json(
      { error: "Failed to save shift count" },
      { status: 500 },
    );
  }
}

// SUPERVISOR DISPUTE RESOLUTION — a decision: MANAGER level + reason + audit.
export async function PUT(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id && !user.isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await requireManagerLevel(user);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 });
    }

    const body = await request.json();
    const { countId, finalCount } = body;

    if (!countId || finalCount === undefined) {
      return NextResponse.json(
        { error: "countId and finalCount are required" },
        { status: 400 },
      );
    }
    const reasonCheck = validateReason(body);
    if (!reasonCheck.ok) {
      return NextResponse.json({ error: reasonCheck.error }, { status: 400 });
    }

    const resolved = await (prisma as any).shiftCount.update({
      where: { id: countId },
      data: {
        finalCount: parseInt(finalCount, 10),
        status: "RESOLVED",
        note: reasonCheck.reason,
      },
      include: {
        machine: true,
        fromShift: true,
        toShift: true,
        outgoingUser: true,
        incomingUser: true,
      },
    });

    await auditDecision({
      actor: user.name || "Supervisor",
      action: "SHIFT_COUNT",
      entityType: "ShiftCount",
      entityId: countId,
      reason: reasonCheck.reason || "",
    });

    return NextResponse.json(resolved);
  } catch (error: any) {
    console.error("Resolve shift count error:", error);
    return NextResponse.json(
      { error: "Failed to resolve shift count" },
      { status: 500 },
    );
  }
}
