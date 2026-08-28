import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const machineCode = searchParams.get("machine") || "CNC-01";

    const [machines, workOrders] = await Promise.all([
      prisma.machine.findMany({
        where: { isActive: true },
        include: { line: true },
        orderBy: { code: "asc" },
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: { product: true },
        orderBy: { woNumber: "asc" },
      }),
    ]);

    const activeMachine =
      machines.find((m) => m.code === machineCode) || machines[0];
    const activeWo = workOrders[0];

    const cellData = {
      cellId: `CELL-${activeMachine?.code || "CNC-01"}`,
      cellName: `${activeMachine?.name || "5-Axis Machining Center"} Workcell`,
      machine: {
        id: activeMachine?.id,
        code: activeMachine?.code,
        name: activeMachine?.name,
        status: activeMachine?.status,
        lineName: activeMachine?.line?.name || "Main Production Line",
      },
      workOrder: {
        woNumber: activeWo?.woNumber || "WO-1001",
        productName: activeWo?.product?.name || "Gear Housing",
        sku: activeWo?.product?.sku || "PRD-AL-HOUSING",
        plannedQty: activeWo?.plannedQuantity || 100,
        goodQty: activeWo?.packedQuantity || 48,
        cycleTimeSec: 145,
      },
      telemetry: {
        spindleRpm: activeMachine?.status === "RUNNING" ? 12450 : 0,
        spindleLoadPct: activeMachine?.status === "RUNNING" ? 64 : 0,
        feedRateMmMin: activeMachine?.status === "RUNNING" ? 2800 : 0,
        vibrationMmSec: activeMachine?.status === "RUNNING" ? 1.28 : 0.05,
        coolantPressureBar: activeMachine?.status === "RUNNING" ? 24.5 : 0,
        spindleTempC: activeMachine?.status === "RUNNING" ? 43.2 : 24.0,
      },
      components: [
        {
          id: "comp-spindle",
          name: "Spindle Head (BT-40)",
          state: activeMachine?.status === "RUNNING" ? "ROTATING" : "STOPPED",
          pos: [0, 1.8, 0],
        },
        {
          id: "comp-table",
          name: "Trunnion Rotary Table (A/C Axes)",
          state: "INDEXED",
          pos: [0, 0.8, 0],
        },
        {
          id: "comp-robot",
          name: "Fanuc M-20iD/25 Handling Robot",
          state: "STANDBY_WAITING_DOOR",
          pos: [2.2, 0, 0],
        },
        {
          id: "comp-infeed",
          name: "Raw Billet Infeed Conveyor",
          state: "FEEDING",
          pos: [3.5, 0.6, -1.2],
        },
        {
          id: "comp-outfeed",
          name: "Finished Part Outfeed Gravity Roller",
          state: "IDLE",
          pos: [3.5, 0.6, 1.2],
        },
        {
          id: "comp-safety",
          name: "Optical Safety Light Curtain (Category 4)",
          state: "CLEAR_ACTIVE",
          pos: [1.8, 1.0, 0],
        },
      ],
    };

    return NextResponse.json({
      machines: machines.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        status: m.status,
      })),
      cellData,
    });
  } catch (error: any) {
    console.error("Cell digital twin error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load cell data" },
      { status: 500 },
    );
  }
}
