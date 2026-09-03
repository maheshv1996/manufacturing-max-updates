import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plants = await prisma.plant.findMany();
    const rawMaterials = await prisma.rawMaterial.findMany({ take: 8 });

    const transfers = [
      {
        id: "stn-001",
        stnNumber: "STN-2026-089",
        sourcePlant: "Unit 1 — Main Aerospace Bay (Bangalore)",
        destPlant: "Unit 2 — Titanium Machining Bay (Hyderabad)",
        material: "Titanium 6Al-4V Round Bar Ø80mm",
        quantity: "150 kg",
        status: "IN_TRANSIT",
        vehicleNumber: "KA-01-MJ-9920",
        eta: "Tomorrow 10:00 AM",
      },
      {
        id: "stn-002",
        stnNumber: "STN-2026-088",
        sourcePlant: "Unit 2 — Titanium Machining Bay (Hyderabad)",
        destPlant: "Unit 1 — Main Aerospace Bay (Bangalore)",
        material: "Carbide End Mills 12mm 5-Flute",
        quantity: "20 pcs",
        status: "DELIVERED",
        vehicleNumber: "KA-04-E-4421",
        eta: "Delivered Yesterday",
      },
    ];

    return NextResponse.json({ success: true, transfers, plants, rawMaterials });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "PLANT_TRANSFER_CREATED", entityType: "PlantTransfer", details: "Plant transfer initiated" });
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const stnNumber = `STN-2026-${Math.floor(100 + Math.random() * 900)}`;
    return NextResponse.json({
      success: true,
      message: `Issued Inter-Plant Stock Transfer Note ${stnNumber} for ${body.material || "items"}!`,
      stnNumber,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
