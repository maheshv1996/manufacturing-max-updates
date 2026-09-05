import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { computeVendorStatus } from "@/lib/calibration";
import { logAudit, logAuditTx } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "quality.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId, fromStation, toStation, quantity, movedByName } = body;

    if (!workOrderId || !toStation || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }
    const actor = user.name || user.email || movedByName || "Operator";

    // Fetch the work order with its product's routing steps
    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        product: {
          include: {
            routingSteps: {
              include: { specialProcessVendor: true },
              orderBy: { seq: "asc" },
            },
          },
        },
        productionLogs: { select: { goodQuantity: true } },
        holdPointSignoffs: true,
      },
    });

    if (wo) {
      const currentStep = wo.product.routingSteps.find(
        (s) => s.seq === wo.currentSeq,
      );

      // HOLD POINT ENFORCEMENT
      if (currentStep && currentStep.isHoldPoint) {
        // Find signoffs for this step
        const signoffs = wo.holdPointSignoffs.filter(
          (s) => s.routingStepId === currentStep.id,
        );

        let blocked = false;
        if (wo.trackingMode === "SERIAL") {
          // For serial mode, we need at least 'quantity' number of unique serial signoffs
          const totalSignedSerials = new Set(
            signoffs.map((s) => s.serialUnitId).filter(Boolean),
          ).size;

          // Count total moved from this station
          const movedLogs = await prisma.movementLog.findMany({
            where: { workOrderId, fromStation: currentStep.stationName },
            select: { quantity: true },
          });
          const totalMoved = movedLogs.reduce((sum, m) => sum + m.quantity, 0);

          if (totalSignedSerials < totalMoved + Number(quantity)) {
            blocked = true;
          }
        } else {
          // BATCH mode: Just need one sign-off for this WO and step
          if (signoffs.length === 0) {
            blocked = true;
          }
        }

        if (blocked) {
          // Audit log for blocked attempt
          await logAudit({
            action: "HOLDPOINT_BLOCKED",
            actor,
            details: `Blocked movement of ${quantity} at ${currentStep.stationName} (Hold Authority: ${currentStep.holdAuthority})`,
            entityType: "WorkOrder",
            entityId: workOrderId,
          });
          return NextResponse.json(
            {
              error: "Hold point inspection required",
              code: "HOLDPOINT_BLOCKED",
              authority: currentStep.holdAuthority,
              stepId: currentStep.id,
            },
            { status: 403 },
          );
        }
      }

      // SPECIAL PROCESS VENDOR ENFORCEMENT (Nadcap)
      // The WO cannot be dispatched to a routing step whose linked vendor's Nadcap cert is EXPIRED.
      const destStep = wo.product.routingSteps.find(
        (s) => s.seq === wo.currentSeq + 1,
      );
      if (destStep && destStep.specialProcessVendor) {
        const vendorStatus = computeVendorStatus(
          destStep.specialProcessVendor.expiresAt,
        );
        if (vendorStatus === "EXPIRED") {
          await logAudit({ action: "VENDOR_EXPIRED_BLOCKED", actor, details: `Blocked dispatch to ${destStep.stationName}: vendor ${destStep.specialProcessVendor.name} (${destStep.specialProcessVendor.processType}) Nadcap cert EXPIRED`, entityType: "WorkOrder", entityId: workOrderId });
          return NextResponse.json(
            {
              error: `Special process vendor ${destStep.specialProcessVendor.name} has an EXPIRED Nadcap certificate. Dispatch to ${destStep.stationName} blocked.`,
              code: "VENDOR_EXPIRED",
              vendorName: destStep.specialProcessVendor.name,
            },
            { status: 403 },
          );
        }
      }

      // Create movement log and update sequence atomically
      const movement = await prisma.$transaction(async (tx) => {
        const created = await (tx as any).movementLog.create({
          data: {
            workOrderId,
            fromStation: fromStation || "Unknown",
            toStation,
            quantity: Number(quantity),
            movedByName: actor,
          },
        });

        const nextStep = wo.product.routingSteps.find(
          (s) => s.seq === wo.currentSeq + 1,
        );

        if (currentStep && nextStep) {
          // Get total quantity already moved from this station
          const movedLogs = await (tx as any).movementLog.findMany({
            where: { workOrderId, fromStation: currentStep.stationName },
            select: { quantity: true },
          });
          const totalMoved = movedLogs.reduce((sum: number, m: any) => sum + m.quantity, 0);

          // Advance seq if moved quantity covers the planned quantity threshold (>= 80% of planned)
          const threshold = wo.plannedQuantity * 0.8;
          if (
            totalMoved >= threshold &&
            wo.currentSeq < wo.product.routingSteps.length
          ) {
            await (tx as any).workOrder.update({
              where: { id: workOrderId },
              data: { currentSeq: wo.currentSeq + 1 },
            });
          }
        }

        await logAuditTx(tx, {
          actor,
          action: "MOVEMENT_POSTED",
          entityType: "MovementLog",
          entityId: created.id,
          details: `Moved ${quantity} units from ${fromStation || "Unknown"} to ${toStation} on WO ${workOrderId}`,
        });

        return created;
      });

      return NextResponse.json({ success: true, movement });
    } else {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 },
      );
    }
  } catch (error) {
    console.error("Movement POST error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const workOrderId = searchParams.get("workOrderId");

    if (!workOrderId) {
      return NextResponse.json(
        { error: "workOrderId required" },
        { status: 400 },
      );
    }

    const logs = await prisma.movementLog.findMany({
      where: { workOrderId },
      orderBy: { at: "asc" },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Movement GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
