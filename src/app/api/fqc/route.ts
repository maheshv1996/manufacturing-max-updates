import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user || (!user.isOwner && !can(user, "quality.view"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [checklists, dispatchableWos] = await Promise.all([
      prisma.fqcChecklist.findMany({
        include: {
          workOrder: {
            select: {
              woNumber: true,
              customerName: true,
              status: true,
              product: { select: { name: true } },
              dataPackages: { select: { packageNumber: true, status: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.workOrder.findMany({
        where: { status: "COMPLETED" },
        include: {
          product: { select: { name: true } },
          dispatchRecords: { select: { id: true } },
          dataPackages: { select: { packageNumber: true, status: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);

    const enrichedWos = dispatchableWos.map((w: any) => {
      const cl = checklists.find((c) => c.workOrderId === w.id);
      const releasedDp = (w.dataPackages || []).some(
        (d: any) => d.status === "RELEASED",
      );
      return {
        ...w,
        checklist: cl || null,
        complete: !!(
          cl?.finalInspectionPassed &&
          cl?.packingDone &&
          cl?.docPackDone &&
          releasedDp
        ),
        releasedDp,
      };
    });

    return NextResponse.json({
      checklists: checklists.map((c) => ({
        ...c,
        complete: !!(c.finalInspectionPassed && c.packingDone && c.docPackDone),
      })),
      dispatchableWos: enrichedWos,
      stats: {
        complete: checklists.filter(
          (c) => c.finalInspectionPassed && c.packingDone && c.docPackDone,
        ).length,
        pending: checklists.filter(
          (c) => !(c.finalInspectionPassed && c.packingDone && c.docPackDone),
        ).length,
        unstarted: enrichedWos.filter((w) => !w.checklist).length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/fqc error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "FQC Inspector";
    const user = getUserFromHeaders(headerList);
    if (!user.isOwner && !can(user, "quality.edit")) {
      return NextResponse.json(
        { error: "Insufficient role: quality.edit required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      workOrderId,
      finalInspectionPassed,
      packingDone,
      docPackDone,
      notes,
    } = body;
    if (!workOrderId)
      return NextResponse.json(
        { error: "workOrderId required" },
        { status: 400 },
      );

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });
    if (!wo)
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 },
      );

    const cl = await prisma.fqcChecklist.upsert({
      where: { workOrderId },
      update: {
        finalInspectionPassed: !!finalInspectionPassed,
        packingDone: !!packingDone,
        docPackDone: !!docPackDone,
        inspector: actor,
        checkedAt: new Date(),
        notes: notes || null,
      },
      create: {
        workOrderId,
        finalInspectionPassed: !!finalInspectionPassed,
        packingDone: !!packingDone,
        docPackDone: !!docPackDone,
        inspector: actor,
        checkedAt: new Date(),
        notes: notes || null,
      },
    });

    const complete =
      cl.finalInspectionPassed && cl.packingDone && cl.docPackDone;
    await logAudit({
      actor,
      action: "FQC_CHECKLIST_UPDATED",
      entityType: "WORK_ORDER",
      entityId: workOrderId,
      details: `FQC dispatch checklist for ${wo.woNumber} — final insp ${finalInspectionPassed ? "PASS" : "—"}, packing ${packingDone ? "✓" : "—"}, doc pack ${docPackDone ? "✓" : "—"}${complete ? " · COMPLETE — dispatch unlocked" : ""}`,
    });

    return NextResponse.json({ success: true, item: cl, complete });
  } catch (error: any) {
    console.error("POST /api/fqc error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
