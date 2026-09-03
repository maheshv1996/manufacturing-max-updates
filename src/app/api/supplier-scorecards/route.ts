import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const FIELDS = [
  "supplierId",
  "supplierName",
  "period",
  "onTimeDelivery",
  "qualityPpm",
  "costVariance",
  "responsiveness",
  "notes",
];
const NUMERIC_FIELDS = new Set([
  "onTimeDelivery",
  "qualityPpm",
  "costVariance",
  "responsiveness",
]);

export function computeScore(d: any) {
  const otd = Math.min(100, Math.max(0, Number(d.onTimeDelivery) || 0));
  const ppm = Math.min(
    100,
    Math.max(0, 100 - (Number(d.qualityPpm) || 0) / 1000),
  );
  const cost = Math.min(
    100,
    Math.max(0, 100 - Math.abs(Number(d.costVariance) || 0)),
  );
  const resp = Math.min(5, Math.max(1, Number(d.responsiveness) || 3)) * 20;
  const overallScore =
    Math.round((0.35 * otd + 0.35 * ppm + 0.15 * cost + 0.15 * resp) * 10) / 10;
  const grade =
    overallScore >= 90
      ? "A"
      : overallScore >= 75
        ? "B"
        : overallScore >= 60
          ? "C"
          : "D";
  return { overallScore, grade };
}

function coerce(data: any): any {
  const out: any = {};
  for (const f of FIELDS) {
    if (data[f] === undefined) continue;
    const val = data[f];
    if (NUMERIC_FIELDS.has(f))
      out[f] = val === "" || val == null ? 0 : Number(val);
    else out[f] = val === "" ? null : val;
  }
  return out;
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["supply.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const [scorecards, suppliers] = await Promise.all([
      prisma.supplierScorecard.findMany({
        orderBy: [{ period: "desc" }, { overallScore: "desc" }],
      }),
      prisma.supplier.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    // Always recompute overall/grade on read so legacy rows (e.g. seeded without
    // scores) display correctly even if their stored snapshot is stale.
    const enriched = scorecards.map((s) => ({ ...s, ...computeScore(s) }));
    return NextResponse.json({ scorecards: enriched, suppliers });
  } catch (error) {
    console.error("GET /api/supplier-scorecards error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["supply.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data) {
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    }

    let result: any;
    if (action === "create") {
      result = await prisma.supplierScorecard.create({
        data: { ...coerce(data), ...computeScore(data) },
      });
    } else if (action === "update") {
      if (!data.id)
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      result = await prisma.supplierScorecard.update({
        where: { id: data.id },
        data: { ...coerce(data), ...computeScore(data) },
      });
    } else if (action === "delete") {
      if (!data.id)
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      result = await prisma.supplierScorecard.delete({
        where: { id: data.id },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await logAudit({
      actor: user.name || "Admin",
      action: `${action.toUpperCase()}_SUPPLIER_SCORECARD`,
      entityType: "SUPPLIER_SCORECARD",
      entityId: result?.id || data?.id || "unknown",
      details: `${user.name || "Admin"} ${action} supplier scorecard`,
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/supplier-scorecards error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
