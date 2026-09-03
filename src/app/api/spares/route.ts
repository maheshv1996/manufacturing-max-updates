import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

// M27 — ABC classification: annual usage value = avgDailyUsage x 365 x unitCost.
// Cumulative value Pareto: A <= 70%, B <= 90%, rest C.
export function classifyAbc(spares: any[]) {
  const scored = spares
    .map((s) => ({
      id: s.id,
      value: Number(s.avgDailyUsage || 0) * 365 * Number(s.unitCost || 0),
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = scored.reduce((sum, s) => sum + s.value, 0) || 1;
  let cum = 0;
  return scored.map((s) => {
    cum += s.value;
    const pct = (cum / total) * 100;
    return { id: s.id, cls: pct <= 70 ? "A" : pct <= 90 ? "B" : "C" };
  });
}

const reorderPoint = (s: any) =>
  s.leadTimeDays && Number(s.avgDailyUsage) > 0
    ? Math.ceil(Number(s.leadTimeDays) * Number(s.avgDailyUsage))
    : Number(s.reorderPoint || 0);

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, [
        "maintenance.view",
        "maintenance.edit",
        "supply.view",
        "system.edit",
      ]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [spares, kits, pmRules, jobs] = await Promise.all([
      prisma.sparePart.findMany({ orderBy: { name: "asc" } }),
      prisma.spareKit.findMany({
        include: { items: { include: { spare: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.pMRule.findMany({
        include: {
          machine: { select: { id: true, name: true } },
          kit: { select: { id: true, name: true } },
        },
        where: { isActive: true },
      }),
      prisma.maintenanceJob.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        include: {
          machine: { select: { id: true, name: true } },
          kit: { include: { items: { include: { spare: true } } } },
        },
        orderBy: { openedAt: "desc" },
        take: 100,
      }),
    ]);
    const enriched = spares.map((s) => {
      const rp = reorderPoint(s);
      const belowReorder = s.currentQty <= (rp > 0 ? rp : s.minQty);
      const annualValue =
        Number(s.avgDailyUsage || 0) * 365 * Number(s.unitCost || 0);
      return { ...s, reorderPoint: rp, annualValue, belowReorder };
    });
    const stats = {
      total: spares.length,
      a: spares.filter((s) => s.abcClass === "A").length,
      b: spares.filter((s) => s.abcClass === "B").length,
      c: spares.filter((s) => s.abcClass === "C").length,
      vital: spares.filter((s) => s.vedClass === "V").length,
      essential: spares.filter((s) => s.vedClass === "E").length,
      desirable: spares.filter((s) => s.vedClass === "D").length,
      belowReorder: enriched.filter((s) => s.belowReorder).length,
      unclassified: spares.filter((s) => !s.abcClass).length,
    };
    return NextResponse.json({ spares: enriched, kits, pmRules, jobs, stats });
  } catch (error) {
    console.error("GET /api/spares error:", error);
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
  const actor = user.name || "Admin";
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
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["maintenance.edit", "supply.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager, maintenance.edit or supply.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-spare") {
      const {
        sku,
        name,
        machineCode,
        currentQty,
        minQty,
        unitCost,
        supplierName,
        location,
        notes,
        leadTimeDays,
        avgDailyUsage,
        abcClass,
        vedClass,
      } = data;
      if (!sku || !name)
        return NextResponse.json(
          { error: "sku and name required" },
          { status: 400 },
        );
      const leadTime =
        leadTimeDays !== undefined && leadTimeDays !== null
          ? Math.max(1, parseInt(leadTimeDays, 10) || 15)
          : 15;
      const daily =
        avgDailyUsage !== undefined && avgDailyUsage !== null
          ? Number(avgDailyUsage)
          : 0;
      result = await prisma.sparePart.create({
        data: {
          sku,
          name,
          machineCode: machineCode || null,
          currentQty:
            currentQty !== undefined && currentQty !== null
              ? Number(currentQty)
              : 0,
          minQty: minQty !== undefined && minQty !== null ? Number(minQty) : 0,
          unitCost:
            unitCost !== undefined && unitCost !== null ? Number(unitCost) : 0,
          supplierName: supplierName || null,
          location: location || null,
          notes: notes || null,
          leadTimeDays: leadTime,
          avgDailyUsage: daily,
          reorderPoint: daily > 0 ? Math.ceil(leadTime * daily) : 0,
          abcClass: abcClass || null,
          vedClass: vedClass || null,
        },
      });
      await logAudit({
        actor,
        action: "SPARE_CREATED",
        entityType: "SPARE_PART",
        entityId: result.id,
        details: `${sku} · ${name}`,
      });
    } else if (action === "update-spare") {
      const s = await prisma.sparePart.findUnique({ where: { id: data.id } });
      if (!s)
        return NextResponse.json({ error: "Spare not found" }, { status: 404 });
      const patch: any = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.machineCode !== undefined)
        patch.machineCode = data.machineCode || null;
      if (data.currentQty !== undefined && data.currentQty !== null)
        patch.currentQty = Number(data.currentQty);
      if (data.minQty !== undefined && data.minQty !== null)
        patch.minQty = Number(data.minQty);
      if (data.unitCost !== undefined && data.unitCost !== null)
        patch.unitCost = Number(data.unitCost);
      if (data.supplierName !== undefined)
        patch.supplierName = data.supplierName || null;
      if (data.location !== undefined) patch.location = data.location || null;
      if (data.notes !== undefined) patch.notes = data.notes || null;
      if (data.abcClass !== undefined)
        patch.abcClass = ["A", "B", "C"].includes(data.abcClass)
          ? data.abcClass
          : null;
      if (data.vedClass !== undefined)
        patch.vedClass = ["V", "E", "D"].includes(data.vedClass)
          ? data.vedClass
          : null;
      if (data.leadTimeDays !== undefined && data.leadTimeDays !== null)
        patch.leadTimeDays = Math.max(1, parseInt(data.leadTimeDays, 10) || 15);
      if (data.avgDailyUsage !== undefined && data.avgDailyUsage !== null)
        patch.avgDailyUsage = Number(data.avgDailyUsage);
      const daily =
        patch.avgDailyUsage !== undefined
          ? patch.avgDailyUsage
          : Number(s.avgDailyUsage);
      const lead =
        patch.leadTimeDays !== undefined
          ? patch.leadTimeDays
          : Number(s.leadTimeDays);
      patch.reorderPoint = daily > 0 ? Math.ceil(lead * daily) : 0;
      result = await prisma.sparePart.update({
        where: { id: s.id },
        data: patch,
      });
      await logAudit({
        actor,
        action: "SPARE_UPDATED",
        entityType: "SPARE_PART",
        entityId: s.id,
        details: `${s.sku} · ${result.name}`,
      });
    } else if (action === "auto-classify") {
      const spares = await prisma.sparePart.findMany();
      const classes = classifyAbc(spares);
      let updated = 0;
      for (const c of classes) {
        const r = await prisma.sparePart.update({
          where: { id: c.id },
          data: { abcClass: c.cls },
        });
        if (r.abcClass) updated++;
      }
      result = { updated };
      await logAudit({
        actor,
        action: "SPARE_ABC_CLASSIFIED",
        entityType: "SPARE_PART",
        entityId: "",
        details: `Auto-classified ${updated} spares (Pareto 70/90)`,
      });
    } else if (action === "create-kit") {
      const { name, description, items } = data;
      if (!name)
        return NextResponse.json({ error: "name required" }, { status: 400 });
      result = await prisma.spareKit.create({
        data: {
          name,
          description: description || null,
          items: Array.isArray(items)
            ? {
                create: items
                  .filter((i: any) => i && i.spareId)
                  .map((i: any) => ({
                    spareId: i.spareId,
                    quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
                  })),
              }
            : undefined,
        },
        include: { items: { include: { spare: true } } },
      });
      await logAudit({
        actor,
        action: "SPARE_KIT_CREATED",
        entityType: "SPARE_KIT",
        entityId: result.id,
        details: `${name} · ${result.items.length} item(s)`,
      });
    } else if (action === "set-pm-kit") {
      const rule = await prisma.pMRule.findUnique({
        where: { id: data.pmRuleId },
      });
      if (!rule)
        return NextResponse.json(
          { error: "PM rule not found" },
          { status: 404 },
        );
      result = await prisma.pMRule.update({
        where: { id: rule.id },
        data: { kitId: data.kitId || null },
      });
      await logAudit({
        actor,
        action: "PM_KIT_ATTACHED",
        entityType: "PM_RULE",
        entityId: rule.id,
        details: `Rule "${rule.title}" → kit ${data.kitId || "none"}`,
      });
    } else if (action === "set-job-kit") {
      const job = await prisma.maintenanceJob.findUnique({
        where: { id: data.jobId },
      });
      if (!job)
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      result = await prisma.maintenanceJob.update({
        where: { id: job.id },
        data: { kitId: data.kitId || null },
      });
      await logAudit({
        actor,
        action: "JOB_KIT_ATTACHED",
        entityType: "MAINTENANCE_JOB",
        entityId: job.id,
        details: `Job ${job.id} → kit ${data.kitId || "none"}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/spares error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
