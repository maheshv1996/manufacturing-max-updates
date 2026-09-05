import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAuditTx } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

const TYPES = ["DCP", "CO2", "FOAM", "WATER", "CLEAN_AGENT", "OTHER"];

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, ["ehs.view", "ehs.edit", "system.edit"]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [extinguishers, inspections] = await Promise.all([
      prisma.extinguisher.findMany({ orderBy: { location: "asc" } }),
      prisma.extinguisherInspection.findMany({ orderBy: { month: "desc" } }),
    ]);
    const now = new Date();
    const curMonth = monthKey(now);
    const prevMonth = monthKey(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    );
    const byExtinguisher: Record<string, string[]> = {};
    inspections.forEach((i) => {
      (byExtinguisher[i.extinguisherId] ||= []).push(i.month);
    });

    const enriched = extinguishers.map((e) => {
      const months = byExtinguisher[e.id] || [];
      const inspectedThisMonth = months.includes(curMonth);
      const inspectedLastMonth = months.includes(prevMonth);
      const status = inspectedThisMonth
        ? "OK"
        : inspectedLastMonth
          ? "DUE"
          : "OVERDUE";
      return { ...e, inspections: months.length, status };
    });
    const map: Record<
      string,
      {
        location: string;
        units: any[];
        ok: number;
        due: number;
        overdue: number;
      }
    > = {};
    enriched.forEach((e) => {
      const entry = (map[e.location] ||= {
        location: e.location,
        units: [],
        ok: 0,
        due: 0,
        overdue: 0,
      });
      entry.units.push(e);
      if (e.status === "OK") entry.ok += 1;
      else if (e.status === "DUE") entry.due += 1;
      else entry.overdue += 1;
    });
    const stats = {
      total: enriched.length,
      ok: enriched.filter((e) => e.status === "OK").length,
      due: enriched.filter((e) => e.status === "DUE").length,
      overdue: enriched.filter((e) => e.status === "OVERDUE").length,
      locations: Object.keys(map).length,
    };
    return NextResponse.json({
      extinguishers: enriched,
      map: Object.values(map),
      checklist: enriched
        .filter((e) => e.status !== "OK")
        .sort((a, b) =>
          a.status === b.status
            ? a.location.localeCompare(b.location)
            : a.status === "OVERDUE"
              ? -1
              : 1,
        ),
      month: curMonth,
      types: TYPES,
      stats,
    });
  } catch (error) {
    console.error("GET /api/extinguishers error:", error);
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
      canAny(user, ["ehs.edit", "ops.edit", "system.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager, ehs.edit, or ops.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-extinguisher") {
      const { location, type, capacityKg, notes } = data;
      if (!location || !type)
        return NextResponse.json(
          { error: "location and type required" },
          { status: 400 },
        );
      if (!TYPES.includes(type))
        return NextResponse.json(
          { error: "Invalid extinguisher type" },
          { status: 400 },
        );
      const code = await nextSeqNumber("extinguisher", "code", "EXT");
      result = await prisma.$transaction(async (tx) => {
        const created = await tx.extinguisher.create({
          data: {
            code,
            location,
            type,
            capacityKg:
              capacityKg !== undefined && capacityKg !== null
                ? Number(capacityKg)
                : 0,
            notes: notes || null,
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "EXTINGUISHER_CREATED",
          entityType: "EXTINGUISHER",
          entityId: created.id,
          details: `${code} · ${type} ${created.capacityKg}kg @ ${location}`,
        });
        return created;
      });
    } else if (action === "update-extinguisher") {
      const e = await prisma.extinguisher.findUnique({
        where: { id: data.id },
      });
      if (!e)
        return NextResponse.json(
          { error: "Extinguisher not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.location !== undefined) patch.location = data.location;
      if (data.type !== undefined) patch.type = data.type;
      if (data.capacityKg !== undefined && data.capacityKg !== null)
        patch.capacityKg = Number(data.capacityKg);
      if (data.notes !== undefined) patch.notes = data.notes || null;
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.extinguisher.update({
          where: { id: e.id },
          data: patch,
        });
        await logAuditTx(tx, {
          actor,
          action: "EXTINGUISHER_UPDATED",
          entityType: "EXTINGUISHER",
          entityId: e.id,
          details: `${e.code} · ${updated.location}`,
        });
        return updated;
      });
    } else if (action === "record-inspection") {
      const { extinguisherId, month, conditionOk, notes } = data;
      if (!extinguisherId)
        return NextResponse.json(
          { error: "extinguisherId required" },
          { status: 400 },
        );
      const e = await prisma.extinguisher.findUnique({
        where: { id: extinguisherId },
      });
      if (!e)
        return NextResponse.json(
          { error: "Extinguisher not found" },
          { status: 404 },
        );
      const m = month || monthKey(new Date());
      const existing = await prisma.extinguisherInspection.findUnique({
        where: { extinguisherId_month: { extinguisherId, month: m } },
      });
      if (existing)
        return NextResponse.json(
          { error: "Already inspected this month" },
          { status: 400 },
        );
      result = await prisma.$transaction(async (tx) => {
        const inspection = await tx.extinguisherInspection.create({
          data: {
            extinguisherId,
            month: m,
            conditionOk: conditionOk !== false,
            notes: notes || null,
            inspectedBy: actor,
          },
        });
        await tx.extinguisher.update({
          where: { id: e.id },
          data: { lastInspected: new Date() },
        });
        await logAuditTx(tx, {
          actor,
          action: "EXTINGUISHER_INSPECTED",
          entityType: "EXTINGUISHER_INSPECTION",
          entityId: inspection.id,
          details: `${e.code} · ${m} · ${conditionOk === false ? "NEEDS SERVICE" : "OK"}`,
        });
        return inspection;
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/extinguishers error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
