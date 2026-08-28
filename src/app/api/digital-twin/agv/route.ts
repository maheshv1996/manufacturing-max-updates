import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

let agvFleet = [
  {
    id: "agv-01",
    code: "AGV-Alpha",
    name: "Heavy Raw Material Tugger",
    type: "TUGGER_500KG",
    status: "IN_TRANSIT",
    batteryPct: 88,
    speedMps: 1.2,
    currentLocation: "Aisle-02 (Bay West)",
    destination: "CNC-01 Infeed Station",
    activeMission: "Deliver Titanium Billets Lot #HEAT-X89",
    payloadKg: 450,
    coordinates: { x: 34, y: 55 },
  },
  {
    id: "agv-02",
    code: "AGV-Bravo",
    name: "Finished Parts Unit Shuttle",
    type: "LIFTER_250KG",
    status: "LOADING",
    batteryPct: 64,
    speedMps: 0.0,
    currentLocation: "CNC-02 Outfeed Station",
    destination: "Packaging Line 01",
    activeMission: "Transfer 50 pcs Milled Housings",
    payloadKg: 180,
    coordinates: { x: 62, y: 38 },
  },
  {
    id: "agv-03",
    code: "AGV-Charlie",
    name: "Tool Room Express Courier",
    type: "COURIER_50KG",
    status: "CHARGING",
    batteryPct: 98,
    speedMps: 0.0,
    currentLocation: "Fast Charge Station #3",
    destination: "Standby",
    activeMission: "Charging (98% full)",
    payloadKg: 0,
    coordinates: { x: 12, y: 15 },
  },
];

export async function GET() {
  return NextResponse.json({
    fleet: agvFleet,
    warehouseAsrs: {
      totalCapacityBins: 144,
      occupiedBins: 121,
      utilizationPct: 84.0,
      activeCraneSpeedMps: 2.5,
      craneStatus: "STORING_PALLET",
    },
    stats: {
      totalAgvs: agvFleet.length,
      activeInTransit: agvFleet.filter(
        (a) => a.status === "IN_TRANSIT" || a.status === "LOADING",
      ).length,
      avgBatteryPct: Math.round(
        agvFleet.reduce((sum, a) => sum + a.batteryPct, 0) / agvFleet.length,
      ),
      missionsCompletedToday: 42,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agvId, destination, missionName } = body;

    agvFleet = agvFleet.map((a) =>
      a.id === agvId
        ? {
            ...a,
            status: "IN_TRANSIT",
            destination,
            activeMission: missionName || `Transfer to ${destination}`,
            speedMps: 1.2,
          }
        : a,
    );

    await logAudit({
      actor: "intralogistics-dispatcher",
      action: "AGV_MISSION_DISPATCHED",
      entityType: "AGV",
      entityId: agvId,
      details: `Dispatched AGV to ${destination}: ${missionName}`,
    });

    return NextResponse.json({
      success: true,
      message: `AGV Mission Dispatched to ${destination}`,
    });
  } catch (error: any) {
    console.error("Dispatch AGV error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to dispatch AGV" },
      { status: 500 },
    );
  }
}
