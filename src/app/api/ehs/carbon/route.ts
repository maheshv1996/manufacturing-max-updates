import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const carbonSummary = {
    totalEmissionsKgCo2e: 48250,
    scope1DieselAndGasKg: 6400,
    scope2GridElectricityKg: 28650,
    scope3RawAlloyEmbodiedKg: 13200,
    averageCarbonIntensityPerKgFinishedPart: 4.82,
    cbamExportCertificatesIssued: 14,
  };

  return NextResponse.json({ success: true, carbonSummary });
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "CARBON_EMISSION_LOGGED", entityType: "CarbonLog", details: "Carbon emission data logged" });
  try {
    const { rawMaterialKg, alloyType, machiningKwh, dieselLiters } = await req.json();

    // Emission Factors:
    // Grid: 0.82 kg CO2e per kWh (Indian Grid)
    // Diesel: 2.68 kg CO2e per Liter
    // Titanium: 35.0 kg CO2e per kg
    // Aluminum: 11.5 kg CO2e per kg
    // Stainless: 4.5 kg CO2e per kg

    const alloyFactor = alloyType === "TITANIUM" ? 35.0 : alloyType === "ALUMINUM" ? 11.5 : 4.5;
    const scope1 = (dieselLiters || 0) * 2.68;
    const scope2 = (machiningKwh || 0) * 0.82;
    const scope3 = (rawMaterialKg || 0) * alloyFactor;
    const totalCo2e = scope1 + scope2 + scope3;

    return NextResponse.json({
      success: true,
      scope1Kg: Math.round(scope1),
      scope2Kg: Math.round(scope2),
      scope3Kg: Math.round(scope3),
      totalKgCo2e: Math.round(totalCo2e),
      cbamCompliant: true,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
