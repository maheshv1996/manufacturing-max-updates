import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ncrs = await prisma.ncrReport.findMany({
      include: {
        product: true,
        eightDReports: true,
      },
      orderBy: { raisedAt: "desc" },
    });

    const highSeverity = ncrs.filter((n) => n.severity === "HIGH");

    return NextResponse.json({
      success: true,
      ncrs,
      criticalCount: highSeverity.length,
      quarantinedCount: ncrs.filter((n) => n.disposition === "SCRAP" || n.disposition === "REWORK").length,
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.isOwner &&
      !canAny(user, ["quality.edit", "ops.edit", "system.edit"])
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const ncrId = typeof body.ncrId === "string" ? body.ncrId : "";
    const action = typeof body.action === "string" ? body.action : "";
    const problemDescription = typeof body.problemDescription === "string" ? body.problemDescription : "";

    if (!ncrId) {
      return NextResponse.json({ success: false, error: "ncrId is required" }, { status: 400 });
    }

    const actor = user.name || user.id || "Quality Officer";

    if (action === "QUARANTINE_TRAVELER") {
      const ncr = await prisma.$transaction(async (tx) => {
        const updated = await tx.ncrReport.update({
          where: { id: ncrId },
          data: { disposition: "SCRAP" },
        });

        await logAuditTx(tx, {
          actor,
          action: "NCR_QUARANTINED",
          entityType: "NcrReport",
          entityId: ncrId,
          details: `Lot placed under digital quarantine lockout for NCR ${updated.ncrNumber}`,
          severity: "WARN",
        });

        return updated;
      });

      return NextResponse.json({ success: true, message: "Traveler lot placed under digital quarantine lockout!", ncr });
    }

    if (action === "TRIGGER_8D") {
      const existingNcr = await prisma.ncrReport.findUnique({
        where: { id: ncrId },
        include: { product: true },
      });
      if (!existingNcr) return NextResponse.json({ success: false, error: "NCR not found" }, { status: 404 });

      const reportNumber = `8D-${Date.now().toString().slice(-6)}`;

      const eightD = await prisma.$transaction(async (tx) => {
        const created8D = await tx.eightDReport.create({
          data: {
            reportNumber,
            title: `Root Cause Containment for ${existingNcr.product?.name || "Part"} (NCR ${existingNcr.ncrNumber})`,
            status: "D1_TEAM",
            teamMembers: "Quality Lead (Champion), CNC Cell Supervisor, Metallurgical Lead",
            problemDescription: problemDescription || existingNcr.description || "Dimensional non-conformance breach beyond drawing tolerance.",
            containmentAction: "All parts in active work order traveler quarantined. Downstream machine operations locked out.",
            ncrId: existingNcr.id,
            productId: existingNcr.productId,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "QUALITY_ESCALATION_RAISED",
          entityType: "EightDReport",
          entityId: created8D.id,
          details: `Auto-generated 8D Investigation Case ${reportNumber} for NCR ${existingNcr.ncrNumber}`,
        });

        return created8D;
      });

      return NextResponse.json({ success: true, message: `Auto-generated 8D Investigation Case ${reportNumber}!`, eightD });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
