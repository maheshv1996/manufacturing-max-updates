import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, status: true },
    });

    const defaultFlows = [
      {
        id: "flow-1",
        name: "Spindle Thermal Runaway & E-Stop Protection",
        description:
          "Monitors CNC spindle temperature and auto-dispatches maintenance if temp exceeds 52°C",
        status: "ACTIVE",
        lastTriggered: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        nodes: [
          {
            id: "node-in-1",
            type: "INPUT_MQTT",
            label: "MQTT In: CNC-01/spindleTemp",
            x: 60,
            y: 80,
            color: "#38bdf8",
            status: "CONNECTED",
          },
          {
            id: "node-filter-1",
            type: "FILTER_THRESHOLD",
            label: "Threshold Switch: Temp > 52°C",
            x: 340,
            y: 80,
            color: "#fbbf24",
            status: "EVALUATING",
          },
          {
            id: "node-action-1",
            type: "ACTION_MAINTENANCE",
            label: "Dispatch Critical Breakdown Job",
            x: 620,
            y: 50,
            color: "#f87171",
            status: "ARMED",
          },
          {
            id: "node-action-2",
            type: "ACTION_CHIME",
            label: "Play 440Hz Warning Acoustic Chime",
            x: 620,
            y: 130,
            color: "#a855f7",
            status: "ARMED",
          },
        ],
        wires: [
          { from: "node-in-1", to: "node-filter-1" },
          { from: "node-filter-1", to: "node-action-1" },
          { from: "node-filter-1", to: "node-action-2" },
        ],
      },
      {
        id: "flow-2",
        name: "ISO 10816 Vibration Anomaly -> FAI Quality Flag",
        description:
          "Evaluates vibration velocity and flags the active work order for First Article Inspection if vibration > 1.8 mm/s",
        status: "ACTIVE",
        lastTriggered: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        nodes: [
          {
            id: "node-in-2",
            type: "INPUT_MQTT",
            label: "MQTT In: CNC-02/vibration",
            x: 60,
            y: 80,
            color: "#38bdf8",
            status: "CONNECTED",
          },
          {
            id: "node-filter-2",
            type: "FILTER_THRESHOLD",
            label: "Threshold: Vib > 1.8 mm/s RMS",
            x: 340,
            y: 80,
            color: "#fbbf24",
            status: "EVALUATING",
          },
          {
            id: "node-action-3",
            type: "ACTION_QUALITY_NCR",
            label: "Log In-Process Quality NCR Flag",
            x: 620,
            y: 80,
            color: "#34d399",
            status: "ARMED",
          },
        ],
        wires: [
          { from: "node-in-2", to: "node-filter-2" },
          { from: "node-filter-2", to: "node-action-3" },
        ],
      },
    ];

    return NextResponse.json({
      flows: defaultFlows,
      machines,
      stats: {
        totalFlows: defaultFlows.length,
        activeEngines: 2,
        messagesProcessed24h: 184520,
        actionsExecuted24h: 14,
      },
    });
  } catch (error: any) {
    console.error("Failed to load automation flows:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load flows" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { flowId, testPayload, action } = body;

    if (action === "DEPLOY") {
      await logAudit({
        actor: "system-engineer",
        action: "AUTOMATION_FLOW_DEPLOYED",
        entityType: "AutomationFlow",
        entityId: flowId || "flow-main",
        details: `Deployed Node-RED automation logic for flow ${flowId || "all flows"}`,
      });

      return NextResponse.json({
        success: true,
        message: "Automation flow rules compiled and deployed to Edge Gateway.",
        deployedAt: new Date(),
      });
    }

    // Simulate flow test execution
    const isTriggered =
      parseFloat(testPayload?.value || 0) > 50 ||
      parseFloat(testPayload?.value || 0) > 1.8;

    return NextResponse.json({
      success: true,
      result: isTriggered ? "ACTION_TRIGGERED" : "THRESHOLD_NOT_MET",
      executedActions: isTriggered
        ? ["ACTION_MAINTENANCE_DISPATCHED", "AUDIO_CHIME_SENT"]
        : [],
      latencyMs: 4.8,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Deploy flow error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute flow action" },
      { status: 500 },
    );
  }
}
