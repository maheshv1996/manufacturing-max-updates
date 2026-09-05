import { logAuditTx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const inspections = [
    {
      id: "CSI-2026-089",
      agency: "DGAQA",
      agencyFull: "Directorate General of Aeronautical Quality Assurance",
      inspectorName: "Wg Cdr R. K. Sharma (Retd / Resident Inspector)",
      workOrderNumber: "WO-2026-0412",
      partNumber: "TASL-AP-6842",
      partName: "Titanium Apache Fuselage Spar Bulkhead",
      heatNumber: "MID-TI-8942-A",
      batchQty: 12,
      inspectedQty: 12,
      passedQty: 12,
      status: "CLEARED",
      witnessedTests: [
        { name: "Raw Material MTC & Chemical Spectroscopy", status: "PASSED", cert: "MTC-MID-8942" },
        { name: "Fluorescent Penetrant Inspection (FPI Level 3)", status: "PASSED", cert: "NDT-FPI-0441" },
        { name: "CMM Coordinate Verification (Zeiss Prismo)", status: "PASSED", cert: "CMM-8842-12" },
        { name: "Tensile & Yield Proof Load", status: "PASSED", cert: "MECH-0912" },
      ],
      stampNumber: "DGAQA-HYD-774",
      clearanceDate: new Date().toISOString(),
      remarks: "100% dimensions within drawing tolerance. Full melt lot pedigree verified against AMS 4928.",
    },
    {
      id: "CSI-2026-090",
      agency: "CEMILAC",
      agencyFull: "Centre for Military Airworthiness and Certification",
      inspectorName: "Dr. S. Venugopal (Airworthiness Officer)",
      workOrderNumber: "WO-2026-0428",
      partNumber: "BDL-MSL-902",
      partName: "Maraging Steel Rocket Motor Nozzle Liner",
      heatNumber: "VIM-250-771",
      batchQty: 6,
      inspectedQty: 6,
      passedQty: 6,
      status: "CLEARED",
      witnessedTests: [
        { name: "Hydrostatic Pressure Burst Test (250 Bar)", status: "PASSED", cert: "HYDRO-0091" },
        { name: "Radiographic X-Ray Weld Inspection", status: "PASSED", cert: "RT-7710" },
        { name: "Hardness Verification (HRC 52-54)", status: "PASSED", cert: "HARD-441" },
      ],
      stampNumber: "CEMILAC-QC-301",
      clearanceDate: new Date(Date.now() - 86400000).toISOString(),
      remarks: "Approved for flight qualification batch integration.",
    },
    {
      id: "CSI-2026-091",
      agency: "Boeing CSI",
      agencyFull: "Boeing Defense Customer Source Inspection",
      inspectorName: "Marcus Vance (Boeing SQI Lead)",
      workOrderNumber: "WO-2026-0455",
      partNumber: "B737-MAX-WING-RIB",
      partName: "Aerospace 7075-T7351 Machined Wing Rib",
      heatNumber: "ALCOA-77821",
      batchQty: 24,
      inspectedQty: 24,
      passedQty: 0,
      status: "PENDING_INSPECTOR_VISIT",
      witnessedTests: [
        { name: "Conductivity & Anodize Thickness Test", status: "PENDING", cert: "" },
        { name: "Zeiss CMM Profile Tolerance Audit", status: "PENDING", cert: "" },
        { name: "AS9102 First Article Inspection Package", status: "IN_REVIEW", cert: "FAI-737-01" },
      ],
      stampNumber: "",
      clearanceDate: null,
      remarks: "Inspection scheduled for tomorrow morning 10:00 AM.",
    },
  ];

  return NextResponse.json({ success: true, inspections });
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !canAny(user, ["quality.edit", "quality.approve", "ops.edit", "system.edit"])
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const agency = typeof body.agency === "string" ? body.agency : "Agency";
    const workOrderNumber = typeof body.workOrderNumber === "string" ? body.workOrderNumber : "WO";
    const actor = user.name || user.id || "Resident Inspector";

    await prisma.$transaction(async (tx) => {
      await logAuditTx(tx, {
        actor,
        action: "SOURCE_INSPECTION_RECORDED",
        entityType: "SourceInspection",
        details: `Source inspection clearance recorded by ${agency} for ${workOrderNumber}`,
      });
    });

    return NextResponse.json({ success: true, message: "Source Inspection clearance recorded", record: body });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
