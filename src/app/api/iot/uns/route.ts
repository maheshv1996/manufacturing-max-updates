import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [plant, _lines, machines, workOrders] = await Promise.all([
      prisma.plant.findFirst(),
      prisma.productionLine.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.machine.findMany({
        where: { isActive: true },
        include: {
          line: true,
          productionLogs: {
            take: 5,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { code: "asc" },
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: { product: true },
        orderBy: { woNumber: "asc" },
      }),
    ]);

    const enterpriseName = "Apex-Manufacturing-Enterprise";
    const plantName =
      plant?.name?.replace(/\s+/g, "-") || "Bengaluru-Aerospace-Plant-1";

    // Build the ISA-95 Unified Namespace hierarchy
    const unsNodes = machines.map((m, idx) => {
      const lineName = (m.line?.name || "Machining-Cell").replace(/\s+/g, "-");
      const machineCode = m.code;
      const basePath = `${enterpriseName}/${plantName}/Area-01/${lineName}/${machineCode}`;
      const activeWo = workOrders[idx % workOrders.length];

      // Simulated current live sensor telemetry based on machine state
      const isRunning = m.status === "RUNNING";
      const spindleRpm = isRunning
        ? 10000 + Math.floor(Math.random() * 2500)
        : 0;
      const spindleLoadPct = isRunning
        ? 45 + Math.floor(Math.random() * 35)
        : 0;
      const vibrationMmSec = isRunning
        ? Math.round((1.1 + Math.random() * 0.8) * 100) / 100
        : 0.05;
      const bearingTempC = isRunning
        ? Math.round((38 + Math.random() * 8) * 10) / 10
        : 25.0;
      const coolantPressureBar = isRunning
        ? Math.round((22 + Math.random() * 6) * 10) / 10
        : 0;
      const goodCount = 120 + idx * 45 + Math.floor(Math.random() * 15);
      const scrapCount = Math.floor(Math.random() * 3);

      return {
        machineId: m.id,
        machineCode: m.code,
        machineName: m.name,
        lineName: m.line?.name || "General Machining Line",
        status: m.status,
        basePath,
        topics: [
          {
            topic: `${basePath}/state`,
            key: "state",
            value: m.status,
            dataType: "STRING",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/processValue/spindleRpm`,
            key: "spindleRpm",
            value: spindleRpm,
            unit: "RPM",
            dataType: "INTEGER",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/processValue/spindleLoadPct`,
            key: "spindleLoadPct",
            value: spindleLoadPct,
            unit: "%",
            dataType: "FLOAT",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/processValue/vibrationMmSec`,
            key: "vibrationMmSec",
            value: vibrationMmSec,
            unit: "mm/s",
            dataType: "FLOAT",
            quality: vibrationMmSec > 2.0 ? "WARNING_LIMIT" : "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/processValue/bearingTempC`,
            key: "bearingTempC",
            value: bearingTempC,
            unit: "°C",
            dataType: "FLOAT",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/processValue/coolantPressureBar`,
            key: "coolantPressureBar",
            value: coolantPressureBar,
            unit: "Bar",
            dataType: "FLOAT",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/count/goodParts`,
            key: "goodParts",
            value: goodCount,
            unit: "pcs",
            dataType: "INTEGER",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/count/scrapParts`,
            key: "scrapParts",
            value: scrapCount,
            unit: "pcs",
            dataType: "INTEGER",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
          {
            topic: `${basePath}/job/currentWo`,
            key: "currentWo",
            value: {
              woNumber: activeWo?.woNumber || "WO-1001",
              productName: activeWo?.product?.name || "Gear Housing",
              sku: activeWo?.product?.sku || "PRD-AL-01",
            },
            dataType: "JSON",
            quality: "GOOD_192",
            timestamp: new Date().toISOString(),
          },
        ],
      };
    });

    return NextResponse.json({
      enterprise: enterpriseName,
      plant: plantName,
      totalMachines: machines.length,
      totalActiveTopics: unsNodes.reduce((sum, m) => sum + m.topics.length, 0),
      unsNodes,
    });
  } catch (error: any) {
    console.error("Failed to load Unified Namespace data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load UNS" },
      { status: 500 },
    );
  }
}
