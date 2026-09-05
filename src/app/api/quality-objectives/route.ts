import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { requireManagerLevel } from "@/lib/managerGate";
import {
  getObjectiveActuals,
  currentPeriod,
  OBJECTIVE_KPI_TYPES,
} from "@/lib/qualityObjectives";

export const maxDuration = 60;

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isOwner && !canAny(user, ["quality.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || currentPeriod();
    const objectives = await prisma.qualityObjective.findMany({
      orderBy: [{ period: "desc" }, { department: "asc" }],
    });
    const actuals = await getObjectiveActuals(period);
    // Attach actuals to the matching period rows
    const withActuals = objectives.map((o) => {
      const a = actuals.find((r) => r.objective.id === o.id);
      return a
        ? { ...o, actual: a.actual, met: a.met, detail: a.detail }
        : { ...o, actual: null, met: null, detail: "No objective for period" };
    });
    return NextResponse.json({
      objectives: withActuals,
      period,
      kpiTypes: OBJECTIVE_KPI_TYPES,
    });
  } catch (error) {
    console.error("GET /api/quality-objectives error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireManagerLevel(user);
  if (!gate.ok)
    return NextResponse.json({ error: gate.error }, { status: 403 });
  if (!canAny(user, ["quality.edit", "system.edit"]) && !user.isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    let result: any;

    if (action === "create") {
      const { department, kpiType, targetValue, period, ownerName } = data;
      if (
        !department ||
        !kpiType ||
        targetValue === undefined ||
        targetValue === "" ||
        !period
      ) {
        return NextResponse.json(
          { error: "department, kpiType, targetValue and period required" },
          { status: 400 },
        );
      }
      if (!OBJECTIVE_KPI_TYPES.some((k) => k.value === kpiType)) {
        return NextResponse.json({ error: "Invalid kpiType" }, { status: 400 });
      }
      result = await prisma.$transaction(async (tx) => {
        const created = await tx.qualityObjective.create({
          data: {
            department,
            kpiType,
            targetValue: Number(targetValue),
            period,
            ownerName: ownerName || null,
            isActive: data.isActive !== false,
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "Admin",
          action: "OBJECTIVE_CREATED",
          entityType: "QUALITY_OBJECTIVE",
          entityId: created.id,
          details: `${department} ${kpiType} target ${targetValue} for ${period}`,
        });
        return created;
      });
    } else if (action === "update") {
      const { id, ...rest } = data;
      const existing = await prisma.qualityObjective.findUnique({
        where: { id },
      });
      if (!existing)
        return NextResponse.json(
          { error: "Objective not found" },
          { status: 404 },
        );
      const payload: any = { ...rest };
      if (payload.targetValue !== undefined)
        payload.targetValue = Number(payload.targetValue);
      delete payload.id;
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.qualityObjective.update({
          where: { id },
          data: payload,
        });
        await logAuditTx(tx, {
          actor: user.name || "Admin",
          action: "OBJECTIVE_UPDATED",
          entityType: "QUALITY_OBJECTIVE",
          entityId: id,
          details: `${updated.department} ${updated.kpiType} target ${updated.targetValue}`,
        });
        return updated;
      });
    } else if (action === "delete") {
      const existing = await prisma.qualityObjective.findUnique({
        where: { id: data.id },
      });
      if (!existing)
        return NextResponse.json(
          { error: "Objective not found" },
          { status: 404 },
        );
      await prisma.$transaction(async (tx) => {
        await tx.qualityObjective.delete({ where: { id: data.id } });
        await logAuditTx(tx, {
          actor: user.name || "Admin",
          action: "OBJECTIVE_DELETED",
          entityType: "QUALITY_OBJECTIVE",
          entityId: data.id,
          details: `${existing.department} ${existing.kpiType}`,
        });
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/quality-objectives error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
