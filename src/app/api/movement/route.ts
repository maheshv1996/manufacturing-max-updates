import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeVendorStatus } from "@/lib/calibration";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workOrderId, fromStation, toStation, quantity, movedByName } = body;

    if (!workOrderId || !toStation || !quantity || !movedByName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

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
          // Assuming we are just moving a bulk quantity of serials, we just count how many are signed off
          // and compare with total moved quantity so far + this quantity.
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
          await prisma.auditLog.create({
            data: {
              action: "HOLDPOINT_BLOCKED",
              actor: "system", // We don't have user ID in this payload directly
              details: `Blocked movement of ${quantity} at ${currentStep.stationName} (Hold Authority: ${currentStep.holdAuthority})`,
              entityType: "WorkOrder",
              entityId: workOrderId,
            },
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
          await logAudit({ action: "VENDOR_EXPIRED_BLOCKED", actor: movedByName || "system", details: `Blocked dispatch to ${destStep.stationName}: vendor ${destStep.specialProcessVendor.name} (${destStep.specialProcessVendor.processType}) Nadcap cert EXPIRED`, entityType: "WorkOrder", entityId: workOrderId });
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

      // Create movement log
      const movement = await prisma.movementLog.create({
        data: {
          workOrderId,
          fromStation: fromStation || "Unknown",
          toStation,
          quantity: Number(quantity),
          movedByName,
        },
      });

      const nextStep = wo.product.routingSteps.find(
        (s) => s.seq === wo.currentSeq + 1,
      );

      if (currentStep && nextStep) {
        // Calculate total good quantity produced so far

        // Get total quantity already moved from this station
        const movedLogs = await prisma.movementLog.findMany({
          where: { workOrderId, fromStation: currentStep.stationName },
          select: { quantity: true },
        });
        const totalMoved = movedLogs.reduce((sum, m) => sum + m.quantity, 0);

        // Advance seq if moved quantity covers the planned quantity threshold (>= 80% of planned)
        const threshold = wo.plannedQuantity * 0.8;
        if (
          totalMoved >= threshold &&
          wo.currentSeq < wo.product.routingSteps.length
        ) {
          await prisma.workOrder.update({
            where: { id: workOrderId },
            data: { currentSeq: wo.currentSeq + 1 },
          });
        }
      }

      await logAudit({
        actor: "system",
        action: "MOVEMENT_POSTED",
        entityType: "MovementLog",
        entityId: movement.id,
        details: `Moved ${quantity} units from ${fromStation || "Unknown"} to ${toStation} on WO ${workOrderId}`,
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
