import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const machineCode = searchParams.get("machine") || "CNC-01";

    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      include: { line: true },
      orderBy: { code: "asc" },
    });

    const activeMachine =
      machines.find((m) => m.code === machineCode) || machines[0];

    // Generate 30 high-frequency time-series points (simulating 1-second interval telemetry)
    const now = Date.now();
    const timeSeries = [];
    const isRunning = activeMachine?.status === "RUNNING";

    for (let i = 29; i >= 0; i--) {
      const t = new Date(now - i * 1000).toLocaleTimeString();
      const baseRpm = isRunning ? 12000 : 0;
      const baseLoad = isRunning ? 62 : 0;
      const baseVib = isRunning ? 1.3 : 0.05;
      const baseTemp = isRunning ? 44.5 : 24.0;
      const baseCoolant = isRunning ? 25.0 : 0;
      const basePower = isRunning ? 18.5 : 0.8;

      timeSeries.push({
        time: t,
        spindleRpm: Math.max(
          0,
          Math.round(baseRpm + (Math.random() * 800 - 400)),
        ),
        spindleLoadPct: Math.max(
          0,
          Math.round(baseLoad + (Math.random() * 12 - 6)),
        ),
        vibrationMmSec: Math.max(
          0.01,
          Math.round((baseVib + (Math.random() * 0.4 - 0.2)) * 100) / 100,
        ),
        bearingTempC: Math.max(
          20,
          Math.round((baseTemp + (Math.random() * 2 - 1)) * 10) / 10,
        ),
        coolantPressureBar: Math.max(
          0,
          Math.round((baseCoolant + (Math.random() * 3 - 1.5)) * 10) / 10,
        ),
        powerKw: Math.max(
          0,
          Math.round((basePower + (Math.random() * 2.5 - 1.2)) * 10) / 10,
        ),
      });
    }

    const latest = timeSeries[timeSeries.length - 1];

    // Threshold checks
    const anomalies = [];
    if (latest.vibrationMmSec > 1.8) {
      anomalies.push({
        type: "VIBRATION_SPIKE",
        severity: "WARNING",
        message: `High spindle vibration detected: ${latest.vibrationMmSec} mm/s (Threshold: 1.8 mm/s)`,
        timestamp: latest.time,
      });
    }
    if (latest.bearingTempC > 50.0) {
      anomalies.push({
        type: "BEARING_OVERHEAT",
        severity: "CRITICAL",
        message: `Bearing temperature threshold exceeded: ${latest.bearingTempC} °C (Threshold: 50.0 °C)`,
        timestamp: latest.time,
      });
    }

    return NextResponse.json({
      machines: machines.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        status: m.status,
      })),
      activeMachine: {
        id: activeMachine.id,
        code: activeMachine.code,
        name: activeMachine.name,
        status: activeMachine.status,
        lineName: activeMachine.line?.name || "Main Production Line",
      },
      timeSeries,
      latest,
      anomalies,
    });
  } catch (error: any) {
    console.error("Telemetry error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load telemetry" },
      { status: 500 },
    );
  }
}
