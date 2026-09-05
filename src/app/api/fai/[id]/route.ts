import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const report = await prisma.faiReport.findUnique({
      where: { id },
      include: {
        workOrder: true,
        product: true,
        serialUnit: true,
        characteristics: {
          orderBy: { charNo: "asc" },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("GET /api/fai/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, characteristics, status, notes } = body;
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canEdit = user.isOwner || canAny(user, ["quality.edit", "system.edit"]);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userName = user.name || user.email || "System";

    const report = await prisma.faiReport.findUnique({
      where: { id },
      include: { characteristics: true },
    });

    if (!report)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "IMPORT_QC") {
      const qcParams = await prisma.qCParameter.findMany({
        where: { productId: report.productId },
      });

      if (!qcParams || qcParams.length === 0) {
        return NextResponse.json(
          { error: "No QC Parameters found for product" },
          { status: 400 },
        );
      }

      // Check existing characteristics to prevent duplicate import
      const existingCharNos = new Set(
        report.characteristics.map((c) => c.charNo),
      );

      const importedCount = await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const qc of qcParams) {
          if (!existingCharNos.has(qc.charNo)) {
            await tx.faiCharacteristic.create({
              data: {
                faiReportId: report.id,
                charNo: qc.charNo,
                description: qc.description,
                target: qc.target,
                lsl: qc.lsl,
                usl: qc.usl,
                method: qc.method,
              },
            });
            count++;
          }
        }

        await logAuditTx(tx, {
          actor: userName,
          action: "FAI_UPDATED",
          entityType: "FAI_REPORT",
          entityId: report.id,
          details: `Imported ${count} QC parameters`,
        });

        return count;
      });

      return NextResponse.json({ success: true, importedCount });
    }

    if (action === "UPDATE_CHARS") {
      await prisma.$transaction(async (tx) => {
        for (const char of characteristics) {
          // Auto compute PASS/FAIL if actual is provided and there are limits
          let calcStatus = char.status || "PENDING";
          if (char.actual !== undefined && char.actual !== null) {
            if (char.lsl !== null && char.actual < char.lsl) calcStatus = "FAIL";
            else if (char.usl !== null && char.actual > char.usl)
              calcStatus = "FAIL";
            else calcStatus = "PASS";
          }

          await tx.faiCharacteristic.update({
            where: { id: char.id },
            data: {
              actual: char.actual,
              status: calcStatus,
            },
          });
        }

        await logAuditTx(tx, {
          actor: userName,
          action: "FAI_UPDATED",
          entityType: "FAI_REPORT",
          entityId: report.id,
          details: "Updated characteristics actuals",
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === "CHANGE_STATUS") {
      if (!status)
        return NextResponse.json({ error: "Status required" }, { status: 400 });

      if (status === "SUBMITTED") {
        const pending = report.characteristics.filter(
          (c) => c.status === "PENDING",
        );
        if (pending.length > 0) {
          return NextResponse.json(
            { error: "Cannot submit with PENDING characteristics" },
            { status: 400 },
          );
        }
        const failed = report.characteristics.filter(
          (c) => c.status === "FAIL",
        );
        if (failed.length > 0) {
          return NextResponse.json(
            { error: "Cannot submit with FAIL characteristics" },
            { status: 400 },
          );
        }
      }

      const updateData: any = {
        status,
        notes: notes !== undefined ? notes : report.notes,
      };
      if (status === "APPROVED" || status === "REJECTED") {
        updateData.approvedBy = userName;
        updateData.approvedAt = new Date();
      }

      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.faiReport.update({
          where: { id: report.id },
          data: updateData,
        });

        await logAuditTx(tx, {
          actor: userName,
          action: `FAI_${status}`,
          entityType: "FAI_REPORT",
          entityId: report.id,
          details: `FAI Report marked as ${status}`,
        });

        return res;
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("PUT /api/fai/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 },
    );
  }
}
