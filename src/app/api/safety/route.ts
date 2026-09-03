import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const incidents = await (prisma as any).safetyIncident.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 1. Calculate Days Since Last Critical/High Incident
    const lastCriticalIncident = incidents.find(
      (i: any) =>
        i.type === "INCIDENT" ||
        i.severity === "CRITICAL" ||
        i.severity === "HIGH",
    );

    let daysSinceLastIncident = 42; // default target baseline
    if (lastCriticalIncident) {
      const diffMs =
        Date.now() - new Date(lastCriticalIncident.createdAt).getTime();
      daysSinceLastIncident = Math.max(
        0,
        Math.floor(diffMs / (1000 * 60 * 60 * 24)),
      );
    }

    // 2. Risk Heatmap Matrix (Location x Severity)
    const heatmap: Record<string, Record<string, number>> = {};
    incidents.forEach((i: any) => {
      const loc = i.location || "General Shopfloor";
      if (!heatmap[loc]) {
        heatmap[loc] = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
      }
      if (heatmap[loc][i.severity] !== undefined) {
        heatmap[loc][i.severity] += 1;
      }
    });

    // 3. Open CAPA Count
    const openCapas = incidents.filter(
      (i: any) => i.status === "CAPA_ASSIGNED" || i.status === "OPEN",
    ).length;
    const criticalCount = incidents.filter(
      (i: any) => i.severity === "CRITICAL" || i.severity === "HIGH",
    ).length;

    return NextResponse.json({
      incidents,
      daysSinceLastIncident,
      heatmap,
      openCapas,
      criticalCount,
    });
  } catch (error: any) {
    console.error("GET /api/safety error:", error);
    return NextResponse.json(
      { error: "Failed to fetch safety incidents" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { type, severity, description, location, reportedBy } = body;

    if (!type || !severity || !description || !location) {
      return NextResponse.json(
        { error: "Type, severity, description, and location are required" },
        { status: 400 },
      );
    }

    const incident = await (prisma as any).safetyIncident.create({
      data: {
        type, // NEAR_MISS | HAZARD | PPE_VIOLATION | INCIDENT
        severity, // LOW | MEDIUM | HIGH | CRITICAL
        description,
        location,
        reportedBy: reportedBy || "Operator",
        status: "OPEN",
      },
    });

    await logAudit({
      actor: reportedBy || "Operator",
      action: "SAFETY_INCIDENT_LOGGED",
      entityType: "SafetyIncident",
      entityId: incident.id,
      details: `${type} · ${severity} · ${location} · ${description.slice(0, 80)}`,
    });

    // If HIGH or CRITICAL severity, trigger an Andon alert for any machine matching location!
    if (severity === "HIGH" || severity === "CRITICAL") {
      try {
        const matchingMachine = await prisma.machine.findFirst({
          where: {
            OR: [
              { name: { contains: location, mode: "insensitive" } },
              { code: { contains: location, mode: "insensitive" } },
            ],
          },
        });

        if (matchingMachine) {
          const safetyReason = await prisma.downtimeReason.findFirst({
            where: { category: "OPERATOR" },
          });

          await prisma.downtimeLog.create({
            data: {
              machineId: matchingMachine.id,
              reasonId:
                safetyReason?.id ||
                (await prisma.downtimeReason.findFirst())?.id ||
                "",
              startTime: new Date(),
              notes: `[EHS ALERT - ${severity}] ${description} (Reported by: ${reportedBy || "Operator"})`,
            },
          });
        }
      } catch (andonErr) {
        console.error("Auto Andon trigger error:", andonErr);
      }
    }

    return NextResponse.json({ success: true, incident });
  } catch (error: any) {
    console.error("POST /api/safety error:", error);
    return NextResponse.json(
      { error: "Failed to log safety incident" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, capaOwner, capaDueDate, fiveWhyReason, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Incident ID is required" },
        { status: 400 },
      );
    }

    const existingIncident = await (prisma as any).safetyIncident.findUnique({
      where: { id },
    });
    if (!existingIncident) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    }

    const updatedIncident = await (prisma as any).safetyIncident.update({
      where: { id },
      data: {
        ...(capaOwner ? { capaOwner } : {}),
        ...(capaDueDate ? { capaDueDate: new Date(capaDueDate) } : {}),
        ...(fiveWhyReason ? { fiveWhyReason } : {}),
        ...(status ? { status } : {}),
        adjustmentHistory: [
          ...((existingIncident.adjustmentHistory as any[]) || []),
          {
            action: "CAPA_UPDATED",
            by: "system",
            at: new Date().toISOString(),
            changes: {
              capaOwner,
              capaDueDate,
              status,
              fiveWhyReason: fiveWhyReason ? true : undefined,
            },
          },
        ],
      },
    });

    await logAudit({
      actor: "system",
      action: "SAFETY_INCIDENT_UPDATED",
      entityType: "SafetyIncident",
      entityId: id,
      details: `capaOwner=${capaOwner} · status=${status} · fiveWhy=${fiveWhyReason ? "set" : "no"}`,
    });

    return NextResponse.json({ success: true, incident: updatedIncident });
  } catch (error: any) {
    console.error("PATCH /api/safety error:", error);
    return NextResponse.json(
      { error: "Failed to update CAPA / safety incident" },
      { status: 500 },
    );
  }
}
