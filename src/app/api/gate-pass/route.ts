import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [dispatches, dispatchableWos] = await Promise.all([
      prisma.dispatchRecord.findMany({
        include: {
          workOrder: {
            select: {
              woNumber: true,
              product: { select: { name: true } },
              customerName: true,
            },
          },
        },
        orderBy: { dispatchedAt: "desc" },
        take: 100,
      }),
      prisma.workOrder.findMany({
        where: { status: "COMPLETED" },
        include: {
          product: true,
          dispatchRecords: true,
          invoices: { select: { invoiceNumber: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);
    const stats = {
      dispatches: dispatches.length,
      withGatePass: dispatches.filter((d) => d.gatePassNumber).length,
      pendingDispatch: dispatchableWos.length,
    };
    return NextResponse.json({ dispatches, dispatchableWos, stats });
  } catch (error) {
    console.error("GET /api/gate-pass error:", error);
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
    const {
      workOrderId,
      dispatchedQty,
      carrierName,
      vehicleNumber,
      driverName,
      ewayBillNo,
      notes,
    } = body;

    // P17 — the block: a dispatch without vehicle + driver + e-way bill cannot leave the gate.
    const missing: string[] = [];
    if (!vehicleNumber || !vehicleNumber.trim()) missing.push("vehicle number");
    if (!driverName || !driverName.trim()) missing.push("driver name");
    if (!ewayBillNo || !ewayBillNo.trim())
      missing.push("e-way bill number (GST)");
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Dispatch blocked — missing: ${missing.join(", ")}.`,
          code: "GATE_PASS_INCOMPLETE",
          missing,
        },
        { status: 400 },
      );
    }
    if (!workOrderId || dispatchedQty == null || Number(dispatchedQty) <= 0) {
      return NextResponse.json(
        { error: "workOrderId and dispatchedQty (>0) required" },
        { status: 400 },
      );
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        product: true,
        invoices: { select: { invoiceNumber: true } },
        dataPackages: { select: { packageNumber: true, status: true } },
      },
    });
    if (!wo)
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 },
      );
    if (wo.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Only COMPLETED work orders can be dispatched (this WO is ${wo.status})`,
        },
        { status: 400 },
      );
    }

    // M7 — FQC dispatch checklist + data-package gate: no sign-offs, no dispatch.
    const fqc = await prisma.fqcChecklist.findUnique({
      where: { workOrderId },
    });
    const fqcMissing: string[] = [];
    if (!fqc) fqcMissing.push("FQC checklist");
    else {
      if (!fqc.finalInspectionPassed)
        fqcMissing.push("final inspection sign-off");
      if (!fqc.packingDone) fqcMissing.push("packing confirmation");
      if (!fqc.docPackDone)
        fqcMissing.push("doc pack / data-package confirmation");
    }
    const releasedDp = (wo.dataPackages || []).some(
      (d: any) => d.status === "RELEASED",
    );
    if (!releasedDp) fqcMissing.push("released data package (DP-…)");
    if (fqcMissing.length > 0) {
      return NextResponse.json(
        {
          error: `Dispatch blocked — FQC checklist incomplete: ${fqcMissing.join(", ")}.`,
          code: "FQC_CHECKLIST_INCOMPLETE",
          missing: fqcMissing,
        },
        { status: 400 },
      );
    }

    const seq = await prisma.dispatchRecord.count();
    const challanNumber = `CH-${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`;
    const gatePassNumber = `GP-${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`;

    const dispatch = await prisma.dispatchRecord.create({
      data: {
        challanNumber,
        workOrderId,
        dispatchedQty: Number(dispatchedQty),
        carrierName: carrierName || null,
        vehicleNumber: vehicleNumber.trim(),
        driverName: driverName.trim(),
        ewayBillNo: ewayBillNo.trim(),
        gatePassNumber,
        securityCheckedBy: user.name || "Security",
        dispatchedByName: user.name || "Despatch",
        notes: notes || null,
      },
      include: { workOrder: { include: { product: true } } },
    });

    await logAudit({
      actor: user.name || "Despatch",
      action: "GATE_PASS_ISSUED",
      entityType: "DISPATCH",
      entityId: dispatch.id,
      details: `${gatePassNumber} · ${wo.woNumber} · ${dispatch.dispatchedQty} pcs · ${vehicleNumber} / ${driverName} · e-way ${ewayBillNo}`,
    });

    return NextResponse.json({ success: true, dispatch }, { status: 201 });
  } catch (error) {
    console.error("POST /api/gate-pass error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
