import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

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
    const userName = headerList.get("x-user-name") || "System";

    const report = await (prisma as any).ncrReport.findUnique({
      where: { id },
      include: { quarantine: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Enum-safe sanitization: only accept values the schema actually allows.
    // Free text or stale option labels used to reach prisma and 500 the whole
    // request — validate + coerce instead of crashing.
    const DISPOSITIONS = [
      "USE_AS_IS",
      "REWORK",
      "SCRAP",
      "RETURN_TO_SUPPLIER",
    ];
    const AUTHORITIES = ["QUALITY", "ENGINEERING", "CUSTOMER"];
    const normDisposition = (v: any) => {
      if (!v) return undefined;
      const s = String(v).trim();
      if (s === "RETURN_TO_VENDOR") return "RETURN_TO_SUPPLIER"; // legacy UI label
      return DISPOSITIONS.includes(s) ? s : undefined;
    };
    const normAuthority = (v: any) => {
      if (!v) return undefined;
      const s = String(v).trim().toUpperCase();
      return AUTHORITIES.includes(s) ? s : undefined;
    };

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

    if (action === "DISPOSE" && disposition) {
      updateData.status = "DISPOSITIONED";
      if (disposition === "REWORK" && report.quarantineId) {
        // Find a machine for the rework order (fallback to first active machine)
        const machine = await prisma.machine.findFirst({
          where: { isActive: true },
        });
        if (machine) {
          await prisma.reworkOrder.create({
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
      // Wait, we need an approver. The user closing it is the approver.
      // But we need the User ID for approvedById. We'll use a hardcoded fallback or look it up.
      const user = await prisma.user.findFirst({ where: { name: userName } });
      if (user) {
        updateData.approvedById = user.id;
        updateData.approvedAt = new Date();
      }
    }

    const updated = await (prisma as any).ncrReport.update({
      where: { id },
      data: updateData,
    });

    if (action === "DISPOSE") {
      await logAudit({
        actor: userName,
        action: "NCR_DISPOSITIONED",
        entityType: "NCR",
        entityId: id,
        details: `Dispositioned NCR ${report.ncrNumber} as ${disposition}`,
      });
    }

    if (action === "CLOSE") {
      await logAudit({
        actor: userName,
        action: "NCR_CLOSED",
        entityType: "NCR",
        entityId: id,
        details: `Closed NCR ${report.ncrNumber}`,
      });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error("PUT /api/mrb/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update NCR report" },
      { status: 500 },
    );
  }
}
