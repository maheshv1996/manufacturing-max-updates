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

    const predictions = machines.map((m, idx) => {
      // Predictive wear algorithm based on machine index and simulated run hours
      const isCnc2 = m.code === "CNC-02";
      const healthIndexPct = isCnc2 ? 68.4 : 94.2 - idx * 3.5;
      const rulOperatingHours = isCnc2 ? 48 : 520 - idx * 40;
      const failureProbabilityPct = isCnc2 ? 78.5 : 12.0 + idx * 4.0;
      const riskLevel = isCnc2
        ? "CRITICAL_INTERVENTION"
        : healthIndexPct < 85
          ? "ELEVATED_WEAR"
          : "HEALTHY";

      // Time series forecast degradation points (Days 0 to 14)
      const forecastCurve = Array.from({ length: 10 }, (_, i) => {
        const day = i * 1.5;
        const projectedVibration = isCnc2
          ? Math.min(
              4.5,
              Math.round((1.8 + Math.pow(day / 6, 2) * 0.8) * 100) / 100,
            )
          : Math.round((1.1 + day * 0.04) * 100) / 100;
        const projectedHealth = Math.max(
          20,
          Math.round(healthIndexPct - day * (isCnc2 ? 4.8 : 1.2)),
        );

        return {
          day: `Day +${day.toFixed(1)}`,
          projectedVibrationMmSec: projectedVibration,
          projectedHealthPct: projectedHealth,
        };
      });

      return {
        machineId: m.id,
        machineCode: m.code,
        machineName: m.name,
        lineName: m.line?.name || "Machining Cell A",
        healthIndexPct,
        rulOperatingHours,
        failureProbabilityPct,
        riskLevel,
        primaryWearComponent:
          "Spindle Front Angular Contact Bearing (7014-C-TPA)",
        recommendedAction: isCnc2
          ? "Schedule Preemptive Bearing Replacement during upcoming Sunday PM slot"
          : "Standard monitoring interval; next greasing due in 180 hrs",
        forecastCurve,
      };
    });

    return NextResponse.json({
      predictions,
      stats: {
        totalAnalyzed: machines.length,
        criticalMachines: predictions.filter(
          (p) => p.riskLevel === "CRITICAL_INTERVENTION",
        ).length,
        avgFleetHealthPct: Math.round(
          predictions.reduce((sum, p) => sum + p.healthIndexPct, 0) /
            predictions.length,
        ),
        estimatedUnplannedDowntimeSavedHours: 36,
      },
    });
  } catch (error: any) {
    console.error("Predictive maintenance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load predictive data" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { machineId, action, component } = body;

    await logAudit({
      actor: "reliability-engineer",
      action: "PREDICTIVE_MAINTENANCE_DISPATCHED",
      entityType: "Machine",
      entityId: machineId,
      details: `Scheduled preemptive maintenance replacement (action: ${action || "REPLACE"}) for ${component} on machine ${machineId}`,
    });

    return NextResponse.json({
      success: true,
      message: `Preemptive replacement work order successfully scheduled for ${component}.`,
      scheduledDate: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 2,
      ).toLocaleDateString(),
    });
  } catch (error: any) {
    console.error("Schedule predictive error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to schedule maintenance" },
      { status: 500 },
    );
  }
}
