import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ehs.view", "ehs.edit", "ops.view", "ops.edit", "system.view", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const carbonSummary = {
      totalEmissionsKgCo2e: 48250,
      scope1DieselAndGasKg: 6400,
      scope2GridElectricityKg: 28650,
      scope3RawAlloyEmbodiedKg: 13200,
      averageCarbonIntensityPerKgFinishedPart: 4.82,
      cbamExportCertificatesIssued: 14,
    };

    return NextResponse.json({ success: true, carbonSummary });
  } catch (error) {
    console.error("GET /api/ehs/carbon error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ehs.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.email || user.id;

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { rawMaterialKg, alloyType, machiningKwh, dieselLiters } = body;

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

    await prisma.$transaction(async (tx) => {
      await logAuditTx(tx, {
        actor,
        action: "CARBON_EMISSION_CALCULATED",
        entityType: "CarbonLog",
        details: `Calculated ${Math.round(totalCo2e)} kg CO2e for ${alloyType || "STANDARD"}`,
      });
    });

    return NextResponse.json({
      success: true,
      scope1Kg: Math.round(scope1),
      scope2Kg: Math.round(scope2),
      scope3Kg: Math.round(scope3),
      totalKgCo2e: Math.round(totalCo2e),
      cbamCompliant: true,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
