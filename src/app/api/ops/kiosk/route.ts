import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

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
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.view", "terminal.use", "system.view"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      kiosk: workstationState,
    });
  } catch (error) {
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
    if (!user.isOwner && !canAny(user, ["ops.edit", "terminal.use", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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

    await prisma.$transaction(async (tx) => {
      await logAuditTx(tx, {
        actor: user.name || workstationState.operatorName,
        action: `KIOSK_${action}`,
        entityType: "WorkOrder",
        entityId: workstationState.activeWoNumber,
        details: `Operator clocked ${action} (Good: ${workstationState.goodPieces}, Scrap: ${workstationState.scrapPieces}, Reason: ${reason || "N/A"})`,
      });
    });

    return NextResponse.json({
      success: true,
      kiosk: workstationState,
    });
  } catch (error: any) {
    console.error("Kiosk error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
