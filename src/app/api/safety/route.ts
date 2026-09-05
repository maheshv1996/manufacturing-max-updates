import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["ehs.view", "ehs.edit", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["ehs.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    const actor = user.name || user.id || reportedBy || "Operator";

    const incident = await prisma.$transaction(async (tx) => {
      const inc = await (tx as any).safetyIncident.create({
        data: {
          type,
          severity,
          description,
          location,
          reportedBy: actor,
          status: "OPEN",
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "SAFETY_INCIDENT_LOGGED",
        entityType: "SafetyIncident",
        entityId: inc.id,
        details: `${type} · ${severity} · ${location} · ${description.slice(0, 80)}`,
      });

      if (severity === "HIGH" || severity === "CRITICAL") {
        try {
          const matchingMachine = await tx.machine.findFirst({
            where: {
              OR: [
                { name: { contains: location, mode: "insensitive" } },
                { code: { contains: location, mode: "insensitive" } },
              ],
            },
          });

          if (matchingMachine) {
            const safetyReason = await tx.downtimeReason.findFirst({
              where: { category: "OPERATOR" },
            });

            await tx.downtimeLog.create({
              data: {
                machineId: matchingMachine.id,
                reasonId:
                  safetyReason?.id ||
                  (await tx.downtimeReason.findFirst())?.id ||
                  "",
                startTime: new Date(),
                notes: `[EHS ALERT - ${severity}] ${description} (Reported by: ${actor})`,
              },
            });
          }
        } catch (andonErr) {
          console.error("Auto Andon trigger error:", andonErr);
        }
      }

      return inc;
    });

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
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["ehs.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    const actor = user.name || user.id || "system";

    const updatedIncident = await prisma.$transaction(async (tx) => {
      const up = await (tx as any).safetyIncident.update({
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
              by: actor,
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

      await logAuditTx(tx, {
        actor,
        action: "SAFETY_INCIDENT_UPDATED",
        entityType: "SafetyIncident",
        entityId: id,
        details: `capaOwner=${capaOwner} · status=${status} · fiveWhy=${fiveWhyReason ? "set" : "no"}`,
      });

      return up;
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
