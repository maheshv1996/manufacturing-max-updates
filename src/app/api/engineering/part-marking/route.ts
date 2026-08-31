import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "PART_MARKING_SPEC_SAVED", entityType: "PartMarkingSpec", details: "Part marking specification saved" });
  try {
    const { cageCode, partNumber, serialNumber, lotNumber, standard } = await req.json();

    // Standard MIL-STD-130 UID Construct #2 format
    // Syntax: [)> (RS) 06 (GS) 17V <CAGE> (GS) 1P <PART> (GS) S <SERIAL> (RS) (EOT)
    const rs = "\x1E"; // Record Separator
    const gs = "\x1D"; // Group Separator
    const eot = "\x04"; // End of Transmission

    const rawSyntax = `[)>${rs}06${gs}17V${cageCode || "7842A"}${gs}1P${partNumber || "AERO-01"}${gs}S${serialNumber || "SN-001"}${rs}${eot}`;
    const humanReadable = `CAGE: ${cageCode || "7842A"} | PN: ${partNumber || "AERO-01"} | SN: ${serialNumber || "SN-001"} | LOT: ${lotNumber || "LOT-01"}`;

    return NextResponse.json({
      success: true,
      rawSyntax,
      humanReadable,
      matrixDimension: "16x16 ECC-200",
      standard: standard || "MIL-STD-130N Construct 2",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
