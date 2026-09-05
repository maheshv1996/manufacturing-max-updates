import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { normalizeMrbDisposition, normalizeMrbAuthority } from "@/lib/mrbPolicy";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      containmentAction,
      why1,
      why2,
      why3,
      why4,
      why5,
      correctiveAction,
      preventiveAction,
      disposition,
      dispositionAuthority,
      customerNotification,
      status,
      action,
    } = body;

    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canEdit = user.isOwner || canAny(user, ["quality.edit", "ops.edit", "system.edit"]);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userName = user.name || user.email || "System";

    const report = await (prisma as any).ncrReport.findUnique({
      where: { id },
      include: { quarantine: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Enum-safe sanitization (see src/lib/mrbPolicy.ts): only accept values
    // the schema actually allows — validate + coerce instead of crashing.
    const normDisposition = (v: any) => normalizeMrbDisposition(v) ?? undefined;
    const normAuthority = (v: any) => normalizeMrbAuthority(v) ?? undefined;

    if (action === "DISPOSE") {
      if (!normDisposition(disposition)) {
        return NextResponse.json(
          { error: "A valid disposition (USE_AS_IS/REWORK/SCRAP/RETURN_TO_SUPPLIER) is required" },
          { status: 400 },
        );
      }
      if (!normAuthority(dispositionAuthority)) {
        return NextResponse.json(
          { error: "Disposition authority (QUALITY/ENGINEERING/CUSTOMER) is required" },
          { status: 400 },
        );
      }
    }

    const updateData: any = {
      containmentAction:
        containmentAction !== undefined
          ? containmentAction
          : report.containmentAction,
      why1: why1 !== undefined ? why1 : report.why1,
      why2: why2 !== undefined ? why2 : report.why2,
      why3: why3 !== undefined ? why3 : report.why3,
      why4: why4 !== undefined ? why4 : report.why4,
      why5: why5 !== undefined ? why5 : report.why5,
      correctiveAction:
        correctiveAction !== undefined
          ? correctiveAction
          : report.correctiveAction,
      preventiveAction:
        preventiveAction !== undefined
          ? preventiveAction
          : report.preventiveAction,
      disposition:
        normDisposition(disposition) !== undefined
          ? normDisposition(disposition)
          : report.disposition,
      dispositionAuthority:
        normAuthority(dispositionAuthority) !== undefined
          ? normAuthority(dispositionAuthority)
          : report.dispositionAuthority,
      customerNotification:
        customerNotification !== undefined
          ? customerNotification
          : report.customerNotification,
      status: status !== undefined ? status : report.status,
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "DISPOSE" && disposition) {
        updateData.status = "DISPOSITIONED";
        if (disposition === "REWORK" && report.quarantineId) {
          // Find a machine for the rework order (fallback to first active machine)
          const machine = await tx.machine.findFirst({
            where: { isActive: true },
          });
          if (machine) {
            await tx.reworkOrder.create({
              data: {
                quarantineId: report.quarantineId,
                targetMachineId: machine.id,
                routingSteps: "Rework based on MRB Disposition",
                extraLaborHours: 1.0,
                status: "PENDING",
                adjustmentHistory: [
                  {
                    action: "CREATED_FROM_MRB",
                    by: userName,
                    at: new Date().toISOString(),
                    from: `MRB disposition of NCR ${report.ncrNumber}`,
                  },
                ],
              },
            });
          }
        }
      }

      if (action === "CLOSE") {
        updateData.status = "CLOSED";
        updateData.closedAt = new Date();
        const approver = await tx.user.findFirst({ where: { name: userName } });
        if (approver) {
          updateData.approvedById = approver.id;
          updateData.approvedAt = new Date();
        }
      }

      const res = await (tx as any).ncrReport.update({
        where: { id },
        data: updateData,
      });

      if (action === "DISPOSE") {
        await logAuditTx(tx, {
          actor: userName,
          action: "NCR_DISPOSITIONED",
          entityType: "NCR",
          entityId: id,
          details: `Dispositioned NCR ${report.ncrNumber} as ${disposition}`,
        });
      }

      if (action === "CLOSE") {
        await logAuditTx(tx, {
          actor: userName,
          action: "NCR_CLOSED",
          entityType: "NCR",
          entityId: id,
          details: `Closed NCR ${report.ncrNumber}`,
        });
      }

      return res;
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error("PUT /api/mrb/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update NCR report" },
      { status: 500 },
    );
  }
}
