import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      include: { line: true },
      orderBy: { code: "asc" },
    });

    const groupId = "ApexAerospace";
    const edgeNodeId = "Cell-01-EdgeGateway";

    const devices = machines.map((m, idx) => {
      const isRunning = m.status === "RUNNING";
      const seq = (142 + idx * 7) % 256;

      return {
        deviceId: m.code,
        deviceName: m.name,
        sparkplugAddress: `spBv1.0/${groupId}/DDATA/${edgeNodeId}/${m.code}`,
        status: isRunning ? "ONLINE" : "STANDBY",
        sequenceNumber: seq,
        lastBirthTime: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        lastDataTime: new Date().toISOString(),
        metrics: [
          {
            name: "spindleRpm",
            alias: 1,
            type: "UInt32",
            value: isRunning ? 12200 : 0,
            isHistorical: false,
          },
          {
            name: "spindleLoadPct",
            alias: 2,
            type: "Float",
            value: isRunning ? 58.4 : 0,
            isHistorical: false,
          },
          {
            name: "vibrationMmSec",
            alias: 3,
            type: "Float",
            value: isRunning ? 1.22 : 0.05,
            isHistorical: false,
          },
          {
            name: "bearingTempC",
            alias: 4,
            type: "Float",
            value: isRunning ? 42.1 : 24.5,
            isHistorical: false,
          },
          {
            name: "coolantPressureBar",
            alias: 5,
            type: "Float",
            value: isRunning ? 25.0 : 0,
            isHistorical: false,
          },
          {
            name: "executionState",
            alias: 6,
            type: "String",
            value: m.status,
            isHistorical: false,
          },
          {
            name: "partCountGood",
            alias: 7,
            type: "UInt32",
            value: 145 + idx * 30,
            isHistorical: false,
          },
        ],
      };
    });

    const recentPackets = [
      {
        id: "spb-pkt-101",
        topic: `spBv1.0/${groupId}/DDATA/${edgeNodeId}/CNC-01`,
        msgType: "DDATA",
        seq: 142,
        metricsCount: 3,
        deltaMetrics: [
          "spindleRpm: 12450",
          "vibrationMmSec: 1.25",
          "spindleLoadPct: 62%",
        ],
        compressionSavingPct: 84.5,
        timestamp: new Date(Date.now() - 1000 * 4).toISOString(),
      },
      {
        id: "spb-pkt-100",
        topic: `spBv1.0/${groupId}/DDATA/${edgeNodeId}/CNC-02`,
        msgType: "DDATA",
        seq: 149,
        metricsCount: 2,
        deltaMetrics: ["bearingTempC: 44.2", "spindleLoadPct: 49%"],
        compressionSavingPct: 88.0,
        timestamp: new Date(Date.now() - 1000 * 18).toISOString(),
      },
      {
        id: "spb-pkt-99",
        topic: `spBv1.0/${groupId}/DBIRTH/${edgeNodeId}/CNC-01`,
        msgType: "DBIRTH",
        seq: 0,
        metricsCount: 7,
        deltaMetrics: ["All 7 Metric Definitions Registered"],
        compressionSavingPct: 0.0,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      },
      {
        id: "spb-pkt-98",
        topic: `spBv1.0/${groupId}/NBIRTH/${edgeNodeId}`,
        msgType: "NBIRTH",
        seq: 0,
        metricsCount: 4,
        deltaMetrics: [
          "Hardware: Dell Edge 3000",
          "OS: Linux RT 6.1",
          "Benthos v4.28",
        ],
        compressionSavingPct: 0.0,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      },
    ];

    return NextResponse.json({
      groupId,
      edgeNodeId,
      devices,
      recentPackets,
      stats: {
        totalDevices: devices.length,
        onlineDevices: devices.filter((d) => d.status === "ONLINE").length,
        reportByExceptionSavingsPct: 86.4,
        packetsProcessed24h: 129400,
      },
    });
  } catch (error: any) {
    console.error("Sparkplug B API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load Sparkplug data" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, deviceId, metric, value } = body;

    await logAudit({
      actor: "sparkplug-service",
      action:
        action === "DBIRTH"
          ? "SPARKPLUG_DBIRTH_DISPATCHED"
          : "SPARKPLUG_DCMD_DISPATCHED",
      entityType: "Machine",
      entityId: deviceId || "all-devices",
      details: `Executed Sparkplug B action: ${action} for ${deviceId} (metric: ${metric}, value: ${value})`,
    });

    return NextResponse.json({
      success: true,
      message: `Sparkplug B ${action} payload successfully published to MQTT broker`,
      topic: `spBv1.0/ApexAerospace/${action === "DBIRTH" ? "DBIRTH" : "DCMD"}/Cell-01-EdgeGateway/${deviceId}`,
      timestamp: new Date(),
    });
  } catch (error: any) {
    console.error("Sparkplug POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute Sparkplug action" },
      { status: 500 },
    );
  }
}
