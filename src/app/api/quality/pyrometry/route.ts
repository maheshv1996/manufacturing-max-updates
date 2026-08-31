import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const furnaces = [
    {
      id: "FURN-01",
      name: "Ipsen High-Vacuum Annealing Furnace",
      classType: "CLASS_2",
      classDesc: "Class 2 (± 6°C / ± 10°F Tolerance)",
      tempRange: "400°C to 1200°C",
      lastTusDate: "2026-06-15",
      nextTusDueDate: new Date(Date.now() + 25 * 86400000).toISOString().split("T")[0],
      satFrequency: "BI_WEEKLY",
      lastSatDeltaDegC: 1.2,
      maxAllowedDeltaDegC: 2.0,
      thermocoupleCalibrationCert: "TC-CAL-9982-NABL",
      status: "COMPLIANT",
    },
    {
      id: "FURN-02",
      name: "Seco/Warwick Aging & Tempering Oven",
      classType: "CLASS_1",
      classDesc: "Class 1 (± 3°C / ± 5°F High Precision)",
      tempRange: "150°C to 650°C",
      lastTusDate: "2026-07-01",
      nextTusDueDate: new Date(Date.now() + 85 * 86400000).toISOString().split("T")[0],
      satFrequency: "WEEKLY",
      lastSatDeltaDegC: 0.8,
      maxAllowedDeltaDegC: 1.1,
      thermocoupleCalibrationCert: "TC-CAL-9940-NABL",
      status: "COMPLIANT",
    },
  ];

  return NextResponse.json({ success: true, furnaces });
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "PYROMETRY_RECORDED", entityType: "PyrometryLog", details: "Pyrometry survey logged" });
  try {
    const body = await req.json();
    return NextResponse.json({ success: true, message: "Pyrometry TUS logged", record: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
