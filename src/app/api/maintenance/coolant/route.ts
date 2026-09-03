import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sumps = [
    {
      machineId: "CNC-01",
      machineName: "Hermle C42 5-Axis VMC",
      coolantBrand: "Blaser Swisslube Blasocut 2000",
      tankCapacityLiters: 450,
      brixReading: 8.5,
      multiplier: 1.0,
      actualConcentrationPercent: 8.5,
      targetConcentrationMin: 7.0,
      targetConcentrationMax: 10.0,
      phValue: 9.1,
      trampOilStatus: "LOW",
      odorStatus: "NORMAL",
      lastToppedUpDate: "2026-08-28",
      waterAddedLiters: 25,
      neatOilAddedLiters: 2.5,
      status: "OPTIMAL",
    },
    {
      machineId: "CNC-02",
      machineName: "Mazak Integrex Multi-Tasking",
      coolantBrand: "Castrol Hysol MB 50",
      tankCapacityLiters: 350,
      brixReading: 4.8,
      multiplier: 1.1,
      actualConcentrationPercent: 5.28,
      targetConcentrationMin: 7.0,
      targetConcentrationMax: 10.0,
      phValue: 8.4,
      trampOilStatus: "MODERATE",
      odorStatus: "SLIGHT_SOUR",
      lastToppedUpDate: "2026-08-25",
      waterAddedLiters: 40,
      neatOilAddedLiters: 0,
      status: "LOW_CONCENTRATION_WARNING",
    },
    {
      machineId: "CNC-03",
      machineName: "DMG Mori NLX 2500 Lathe",
      coolantBrand: "Fuchs Ecocool 700",
      tankCapacityLiters: 280,
      brixReading: 12.0,
      multiplier: 1.0,
      actualConcentrationPercent: 12.0,
      targetConcentrationMin: 6.0,
      targetConcentrationMax: 9.0,
      phValue: 9.5,
      trampOilStatus: "LOW",
      odorStatus: "NORMAL",
      lastToppedUpDate: "2026-08-29",
      waterAddedLiters: 0,
      neatOilAddedLiters: 10,
      status: "HIGH_CONCENTRATION_WARNING",
    },
  ];

  return NextResponse.json({ success: true, sumps });
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "COOLANT_LOGGED", entityType: "CoolantLog", details: "Coolant reading logged" });
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Coolant refractometer reading logged", record: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
