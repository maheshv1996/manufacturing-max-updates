import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const workstationState = {
  stationId: "STATION-CNC-01",
  operatorName: "Rajesh Kumar (Badge #OP-442)",
  machineCode: "CNC-01",
  activeWoNumber: "WO-1001",
  productName: "Aerospace Gear Housing (Rev C)",
  sku: "PRD-AL-HOUSING-01",
  plannedQty: 100,
  goodPieces: 48,
  scrapPieces: 2,
  cycleTimeSec: 145,
  state: "RUNNING",
  lastClockTime: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json({
    kiosk: workstationState,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, countDelta, reason } = body;

    if (action === "ADD_GOOD") {
      workstationState.goodPieces += countDelta || 1;
    } else if (action === "ADD_SCRAP") {
      workstationState.scrapPieces += countDelta || 1;
    } else if (action === "TOGGLE_STATE") {
      workstationState.state =
        workstationState.state === "RUNNING" ? "PAUSED" : "RUNNING";
    }

    workstationState.lastClockTime = new Date().toISOString();

    await logAudit({
      actor: workstationState.operatorName,
      action: `KIOSK_${action}`,
      entityType: "WorkOrder",
      entityId: workstationState.activeWoNumber,
      details: `Operator clocked ${action} (Good: ${workstationState.goodPieces}, Scrap: ${workstationState.scrapPieces}, Reason: ${reason || "N/A"})`,
    });

    return NextResponse.json({
      success: true,
      kiosk: workstationState,
    });
  } catch (error: any) {
    console.error("Kiosk error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update kiosk" },
      { status: 500 },
    );
  }
}
