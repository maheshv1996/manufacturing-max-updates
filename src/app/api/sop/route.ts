import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { validateReason } from "@/lib/managerGate";
import { logAuditTx } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { startOfWeek, addWeeks, format, addDays } from "date-fns";

export const maxDuration = 60;

const WORKING_DAYS_PER_WEEK = 5;

function startOfWeekIso(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 }); // Monday
}

async function woLoadHours(wo: any): Promise<number> {
  // per-piece cycle + setup, falling back to the product's target cycle time
  const cycleSec =
    wo.cycleTimeSeconds ?? wo.product?.targetCycleTimeSeconds ?? 60;
  const setupMin = wo.setupTimeMinutes ?? 15;
  return (wo.plannedQuantity * cycleSec) / 3600 + setupMin / 60;
}

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isOwner && !canAny(user, ["ops.view", "commercial.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const weeksCount = Math.min(
      12,
      Math.max(2, Number(searchParams.get("weeks") || 8)),
    );
    const today = new Date();
    const weekStart = startOfWeekIso(today);

    const { dailyAvailableHours } = await getSettings();

    const [machines, openWOs, decisions, windows] = await Promise.all([
      prisma.machine.findMany({ where: { isActive: true } }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: { product: { select: { targetCycleTimeSeconds: true } } },
      }),
      prisma.sopDecision.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.capacityWindow.findMany({
        where: { to: { gte: weekStart } },
        include: { machine: { select: { name: true, code: true } } },
        orderBy: { from: "asc" },
        take: 200,
      }),
    ]);

    const weeks: any[] = [];
    for (let i = 0; i < weeksCount; i++) {
      const ws = addWeeks(weekStart, i);
      const we = addDays(ws, 7);
      const weekKey = format(ws, "yyyy-MM-dd");

      const weekWOs = openWOs.filter(
        (wo) => wo.plannedStartDate >= ws && wo.plannedStartDate < we,
      );
      let requiredHours = 0;
      for (const wo of weekWOs) requiredHours += await woLoadHours(wo);
      const orderQty = weekWOs.reduce((sum, wo) => sum + wo.plannedQuantity, 0);

      const windowsInWeek = windows.filter((w) => w.from < we && w.to >= ws);
      const windowHours = windowsInWeek.reduce(
        (sum, w) => sum + (w.hours ?? 0),
        0,
      );

      const baseAvailable =
        machines.length * dailyAvailableHours * WORKING_DAYS_PER_WEEK;
      const availableHours = Math.max(0, baseAvailable - windowHours);
      const loadPct =
        availableHours > 0
          ? Math.round((requiredHours / availableHours) * 100)
          : 0;
      const gapHours = Math.max(
        0,
        Math.round((requiredHours - availableHours) * 10) / 10,
      );

      weeks.push({
        weekKey,
        weekStart: ws.toISOString(),
        label: format(ws, "dd MMM"),
        orderCount: weekWOs.length,
        orderQty,
        requiredHours: Math.round(requiredHours * 10) / 10,
        baseAvailableHours: Math.round(baseAvailable * 10) / 10,
        windowHours: Math.round(windowHours * 10) / 10,
        availableHours: Math.round(availableHours * 10) / 10,
        loadPct,
        gapHours,
        decisionCount: decisions.filter((d) => {
          const dws = startOfWeekIso(new Date(d.weekStart));
          return format(dws, "yyyy-MM-dd") === weekKey;
        }).length,
      });
    }

    return NextResponse.json({
      weeks,
      machines: machines.map((m) => ({ id: m.id, name: m.name, code: m.code })),
      decisions: decisions.map((d) => ({
        ...d,
        outcome: (d.outcome as any) || [],
        weekStart: d.weekStart.toISOString(),
      })),
      windows: windows.map((w) => ({
        ...w,
        from: w.from.toISOString(),
        to: w.to.toISOString(),
      })),
      dailyAvailableHours,
    });
  } catch (error) {
    console.error("GET /api/sop error:", error);
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
  if (!user.isOwner && !canAny(user, ["ops.edit", "commercial.edit", "system.edit"]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    if (action === "decision") {
      const { weekStart, decisionType, requiredHours, notes, machineId } = data;
      if (!weekStart || !decisionType || !requiredHours)
        return NextResponse.json(
          { error: "weekStart, decisionType and requiredHours required" },
          { status: 400 },
        );
      const hrs = Number(requiredHours);
      if (!(hrs > 0 && hrs <= 200))
        return NextResponse.json(
          { error: "requiredHours must be 0–200" },
          { status: 400 },
        );
      if (!["OVERTIME", "OUTSOURCE", "EXTRA_SHIFT"].includes(decisionType))
        return NextResponse.json(
          { error: "Invalid decisionType" },
          { status: 400 },
        );
      if (decisionType === "OUTSOURCE" && !machineId)
        return NextResponse.json(
          { error: "machineId required for OUTSOURCE" },
          { status: 400 },
        );

      const ws = new Date(weekStart);
      const outcome: any[] = [];

      const decision = await prisma.$transaction(async (tx) => {
        // Auto-create HR OT request(s) — interlink sales -> HR
        if (decisionType === "OVERTIME" || decisionType === "EXTRA_SHIFT") {
          const targetUsers =
            decisionType === "EXTRA_SHIFT"
              ? await tx.user.findMany({
                  where: {
                    isActive: true,
                    role: { name: { in: ["Operator", "OPERATOR"] } },
                  },
                  take: 12,
                })
              : await tx.user.findMany({
                  where: {
                    isActive: true,
                    role: { name: { in: ["Operator", "OPERATOR"] } },
                  },
                  take: 1,
                });
          const perUserHours =
            decisionType === "EXTRA_SHIFT"
              ? Math.min(4, Math.max(1, hrs / Math.max(1, targetUsers.length)))
              : hrs;
          for (const u of targetUsers) {
            const ot = await tx.overtimeRequest.create({
              data: {
                userId: u.id,
                date: ws,
                hours: Math.round(perUserHours * 10) / 10,
                reason: `S&OP ${decisionType === "EXTRA_SHIFT" ? "extra shift" : "overtime"} — week of ${format(ws, "dd MMM yyyy")}${notes ? ` — ${notes.slice(0, 60)}` : ""}`,
                status: "PENDING",
              },
            });
            outcome.push({
              type: "OT_REQUEST",
              refId: ot.id,
              label: `OT ${u.name || u.employeeNumber || u.id}`,
            });
          }
        }

        // Outsource decision -> reserve machine capacity (window) — the work returns for finishing ops
        if (decisionType === "OUTSOURCE") {
          const from = ws;
          const win = await tx.capacityWindow.create({
            data: {
              machineId,
              windowType: "OUTSOURCE",
              title: `Outsource window — S&OP wk ${format(ws, "dd MMM")}`,
              from,
              to: new Date(from.getTime() + hrs * 3600 * 1000),
              hours: hrs,
              reason: notes || "Capacity shortfall — work outsourced",
              createdByName: user.name || "System",
            },
          });
          outcome.push({
            type: "WINDOW",
            refId: win.id,
            label: `Window ${win.title}`,
          });
        }

        const dec = await tx.sopDecision.create({
          data: {
            decisionNumber: `SOP-${format(ws, "yyyyMMdd")}-${Math.floor(100 + Math.random() * 900)}`,
            weekStart: ws,
            decisionType,
            gapHours: hrs,
            requiredHours: hrs,
            notes: notes || null,
            status: "EXECUTED",
            outcome,
            createdByName: user.name || "System",
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "System",
          action: "SOP_DECISION",
          entityType: "SOP",
          entityId: dec.id,
          details: `${decisionType} ${hrs}h wk ${format(ws, "dd MMM yyyy")} — ${outcome.length} auto-action(s)`,
        });
        return dec;
      });

      return NextResponse.json(
        { decision: { ...decision, outcome } },
        { status: 201 },
      );
    }

    if (action === "cancel") {
      const { id, reason } = data;
      if (!id || !validateReason(reason))
        return NextResponse.json(
          { error: "id and reason required" },
          { status: 400 },
        );
      const decision = await prisma.$transaction(async (tx) => {
        const dec = await tx.sopDecision.update({
          where: { id },
          data: { status: "CANCELLED", notes: reason },
        });
        await logAuditTx(tx, {
          actor: user.name || "System",
          action: "SOP_DECISION_CANCELLED",
          entityType: "SOP",
          entityId: id,
          details: reason,
        });
        return dec;
      });
      return NextResponse.json({ decision });
    }

    if (action === "window") {
      const { machineId, title, from, to, hours, reason } = data;
      if (!machineId || !title || !from || !to)
        return NextResponse.json(
          { error: "machineId, title, from, to required" },
          { status: 400 },
        );
      const win = await prisma.$transaction(async (tx) => {
        const w = await tx.capacityWindow.create({
          data: {
            machineId,
            windowType: "MAINTENANCE",
            title,
            from: new Date(from),
            to: new Date(to),
            hours: hours ? Number(hours) : null,
            reason: reason || null,
            createdByName: user.name || "System",
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "System",
          action: "CAPACITY_WINDOW",
          entityType: "MACHINE",
          entityId: machineId,
          details: `${title} (${new Date(from).toISOString().slice(0, 10)} → ${new Date(to).toISOString().slice(0, 10)})`,
        });
        return w;
      });
      return NextResponse.json({ window: win }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/sop error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
