import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSpcStats, SpcMeasurement } from "@/lib/spcData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineCode = searchParams.get("machine") || "CNC-01";
    const characteristic =
      searchParams.get("characteristic") || "Bore Diameter (mm)";

    // Fetch machine
    const machine = await prisma.machine.findFirst({
      where: { code: machineCode },
    });
    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // Fetch SPC measurements, newest last (chronological for charts)
    const rawMeasurements = await prisma.qualityMeasurement.findMany({
      where: { machineId: machine.id, characteristic },
      orderBy: { measuredAt: "asc" },
    });

    const measurements: SpcMeasurement[] = rawMeasurements.map((m) => ({
      id: m.id,
      value: m.value,
      measuredAt: m.measuredAt.toISOString(),
      characteristic: m.characteristic,
      lsl: m.lsl,
      usl: m.usl,
      target: m.target,
    }));

    // Fetch daily production data for P chart (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const productionLogs = await prisma.productionLog.findMany({
      where: {
        machineId: machine.id,
        startTime: { gte: thirtyDaysAgo },
      },
      orderBy: { startTime: "asc" },
    });

    // Group by day
    const dailyMap = new Map<string, { good: number; scrap: number }>();
    for (const log of productionLogs) {
      const date = log.startTime.toISOString().slice(0, 10);
      const existing = dailyMap.get(date) || { good: 0, scrap: 0 };
      existing.good += log.goodQuantity;
      existing.scrap += log.scrapQuantity;
      dailyMap.set(date, existing);
    }

    const pChartInput = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))
      .filter((d) => d.good + d.scrap > 0); // only days with output

    if (measurements.length === 0) {
      return NextResponse.json(
        { error: "No measurements found" },
        { status: 404 },
      );
    }

    const stats = computeSpcStats(measurements, pChartInput);

    return NextResponse.json({
      machine: { id: machine.id, name: machine.name, code: machine.code },
      characteristic,
      ...stats,
    });
  } catch (err) {
    console.error("SPC API error:", err);
    return NextResponse.json(
      { error: "Failed to compute SPC data" },
      { status: 500 },
    );
  }
}
