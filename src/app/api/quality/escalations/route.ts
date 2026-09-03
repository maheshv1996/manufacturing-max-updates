import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "QUALITY_ESCALATION_RAISED", entityType: "QualityEscalation", details: "Quality issue escalated" });
  try {
    const { ncrId, action, problemDescription } = await req.json();

    if (action === "QUARANTINE_TRAVELER") {
      const ncr = await prisma.ncrReport.update({
        where: { id: ncrId },
        data: { disposition: "SCRAP" },
      });
      return NextResponse.json({ success: true, message: "Traveler lot placed under digital quarantine lockout!", ncr });
    }

    if (action === "TRIGGER_8D") {
      const ncr = await prisma.ncrReport.findUnique({
        where: { id: ncrId },
        include: { product: true },
      });
      if (!ncr) return NextResponse.json({ success: false, error: "NCR not found" }, { status: 404 });

      const reportNumber = `8D-${Date.now().toString().slice(-6)}`;
      const eightD = await prisma.eightDReport.create({
        data: {
          reportNumber,
          title: `Root Cause Containment for ${ncr.product?.name || "Part"} (NCR ${ncr.ncrNumber})`,
          status: "D1_TEAM",
          teamMembers: "Quality Lead (Champion), CNC Cell Supervisor, Metallurgical Lead",
          problemDescription: problemDescription || ncr.description || "Dimensional non-conformance breach beyond drawing tolerance.",
          containmentAction: "All parts in active work order traveler quarantined. Downstream machine operations locked out.",
          ncrId: ncr.id,
          productId: ncr.productId,
        },
      });

      return NextResponse.json({ success: true, message: `Auto-generated 8D Investigation Case ${reportNumber}!`, eightD });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
