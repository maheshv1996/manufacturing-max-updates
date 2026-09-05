import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.isOwner &&
      !canAny(user, ["engineering.edit", "quality.edit", "ops.edit", "system.edit"])
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const cageCode = typeof body.cageCode === "string" ? body.cageCode.slice(0, 20) : "7842A";
    const partNumber = typeof body.partNumber === "string" ? body.partNumber.slice(0, 50) : "AERO-01";
    const serialNumber = typeof body.serialNumber === "string" ? body.serialNumber.slice(0, 50) : "SN-001";
    const lotNumber = typeof body.lotNumber === "string" ? body.lotNumber.slice(0, 50) : "LOT-01";
    const standard = typeof body.standard === "string" ? body.standard.slice(0, 50) : "MIL-STD-130N Construct 2";

    // Standard MIL-STD-130 UID Construct #2 format
    // Syntax: [)> (RS) 06 (GS) 17V <CAGE> (GS) 1P <PART> (GS) S <SERIAL> (RS) (EOT)
    const rs = "\x1E"; // Record Separator
    const gs = "\x1D"; // Group Separator
    const eot = "\x04"; // End of Transmission

    const rawSyntax = `[)>${rs}06${gs}17V${cageCode}${gs}1P${partNumber}${gs}S${serialNumber}${rs}${eot}`;
    const humanReadable = `CAGE: ${cageCode} | PN: ${partNumber} | SN: ${serialNumber} | LOT: ${lotNumber}`;

    const actor = user.name || user.id || "Engineer";
    await logAudit({
      actor,
      action: "PART_MARKING_SPEC_GENERATED",
      entityType: "PartMarkingSpec",
      details: `Generated UID construct for ${partNumber} (SN: ${serialNumber})`,
    });

    return NextResponse.json({
      success: true,
      rawSyntax,
      humanReadable,
      matrixDimension: "16x16 ECC-200",
      standard,
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
