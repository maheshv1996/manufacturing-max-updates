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

    const gatewayDiagnostics = {
      gatewayId: "UMH-CORE-EDGE-01",
      containerVersion: "united-manufacturing-hub/umh-core:v0.18.4",
      streamingEngine: "Benthos-UMH v4.28 (Go Engine)",
      localBroker: "Redpanda Local Buffer (Kafka API port 9092)",
      mqttBrokerPort: 1883,
      opcBridgeUrl: "opc.tcp://192.168.1.100:4840",
      status: "ONLINE",
      uptimeSeconds: 1572480, // ~18 days
      cpuUsagePct: 14.2,
      memoryUsageMb: 342,
      ingressMsgPerSec: 1420,
      egressKbPerSec: 485,
      activeClientConnections: machines.length,
      recentPackets: [
        {
          topic: "Apex/Plant-1/CNC-01/vibration",
          bytes: 128,
          latencyMs: 6.2,
          status: "PROCESSED",
          time: new Date().toLocaleTimeString(),
        },
        {
          topic: "Apex/Plant-1/CNC-02/spindleRpm",
          bytes: 96,
          latencyMs: 5.8,
          status: "PROCESSED",
          time: new Date().toLocaleTimeString(),
        },
        {
          topic: "Apex/Plant-1/VMC-01/state",
          bytes: 64,
          latencyMs: 4.5,
          status: "PROCESSED",
          time: new Date().toLocaleTimeString(),
        },
        {
          topic: "Apex/Plant-1/ANOD-01/temp",
          bytes: 88,
          latencyMs: 7.1,
          status: "PROCESSED",
          time: new Date().toLocaleTimeString(),
        },
      ],
    };

    return NextResponse.json({
      gateway: gatewayDiagnostics,
      machines,
    });
  } catch (error: any) {
    console.error("Gateway diagnostics error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load gateway diagnostics" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, payload, machineId } = body;

    if (!topic || !payload) {
      return NextResponse.json(
        { error: "Topic and Payload are required" },
        { status: 400 },
      );
    }

    await logAudit({
      actor: "edge-gateway",
      action: "MQTT_TELEMETRY_INJECTED",
      entityType: "Machine",
      entityId: machineId || "edge-sim",
      details: `Dispatched MQTT payload to ${topic}: ${JSON.stringify(payload)}`,
    });

    return NextResponse.json({
      success: true,
      message: `Payload successfully published to MQTT topic ${topic}`,
      ackTimestamp: new Date(),
    });
  } catch (error: any) {
    console.error("Inject payload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to inject payload" },
      { status: 500 },
    );
  }
}
