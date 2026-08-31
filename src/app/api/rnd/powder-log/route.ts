import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const powderBatches = [
    {
      id: "POWDER-TI-092",
      alloy: "Titanium Ti-6Al-4V ELI (Grade 23)",
      manufacturer: "AP&C (GE Additive)",
      particleSizeDistribution: "15 - 45 μm (Plasma Atomized)",
      virginWeightKg: 100,
      currentWeightKg: 78.5,
      sievePassCount: 4,
      maxAllowedReuses: 10,
      virginBlendRatioPercent: 20,
      chamberOxygenPpmLastRun: 24,
      status: "APPROVED_FOR_PRINTING",
    },
    {
      id: "POWDER-IN-041",
      alloy: "Inconel 718 Superalloy",
      manufacturer: "Sandvik Osprey",
      particleSizeDistribution: "20 - 53 μm (Gas Atomized)",
      virginWeightKg: 150,
      currentWeightKg: 112.0,
      sievePassCount: 7,
      maxAllowedReuses: 8,
      virginBlendRatioPercent: 30,
      chamberOxygenPpmLastRun: 18,
      status: "RECYCLE_LIMIT_WARNING",
    },
  ];

  return NextResponse.json({ success: true, powderBatches });
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "POWDER_CYCLE_LOGGED", entityType: "PowderLog", details: "Additive manufacturing powder cycle logged" });
  try {
    const body = await req.json();
    return NextResponse.json({ success: true, message: "Powder batch recorded", record: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
