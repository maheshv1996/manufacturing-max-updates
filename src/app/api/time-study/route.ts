import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

const FIELDS = [
  "productSku",
  "operationName",
  "department",
  "standardTimeMin",
  "measuredTimeMin",
  "sampleSize",
  "notes",
];
const NUMERIC_FIELDS = new Set([
  "standardTimeMin",
  "measuredTimeMin",
  "sampleSize",
]);

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

// Real shop-floor actual: average minutes per good unit from production logs
// for work orders of the study's product SKU (last 90 days).
async function actualAvgMin(
  productSku?: string | null,
): Promise<number | null> {
  if (!productSku) return null;
  try {
    const logs = await prisma.productionLog.findMany({
      where: {
        endTime: { not: null },
        goodQuantity: { gt: 0 },
        workOrder: { product: { sku: productSku } },
      },
      select: { startTime: true, endTime: true, goodQuantity: true },
      take: 500,
    });
    const samples = logs
      .map((l) => {
        const mins =
          (new Date(l.endTime!).getTime() - new Date(l.startTime).getTime()) /
          60000;
        return mins > 0 ? mins / l.goodQuantity : null;
      })
      .filter((v): v is number => v !== null);
    if (!samples.length) return null;
    return samples.reduce((s, v) => s + v, 0) / samples.length;
  } catch (e) {
    console.error("actualAvgMin error:", e);
    return null;
  }
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["ops.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const studies = await prisma.timeStudy.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const enriched = await Promise.all(
      studies.map(async (s) => {
        const avgMin = await actualAvgMin(s.productSku);
        const variancePct =
          avgMin != null && s.standardTimeMin > 0
            ? Math.round(
                ((avgMin - s.standardTimeMin) / s.standardTimeMin) * 1000,
              ) / 10
            : null;
        return { ...s, actualAvgMin: avgMin, variancePct };
      }),
    );
    return NextResponse.json({ studies: enriched });
  } catch (error) {
    console.error("GET /api/time-study error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit"])) {
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

    if (action !== "create" && action !== "update" && action !== "delete") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if ((action === "update" || action === "delete") && !data.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let res: any;
      if (action === "create") {
        res = await tx.timeStudy.create({ data: coerce(data) });
      } else if (action === "update") {
        res = await tx.timeStudy.update({
          where: { id: data.id },
          data: coerce(data),
        });
      } else if (action === "delete") {
        res = await tx.timeStudy.delete({ where: { id: data.id } });
      }

      await logAuditTx(tx, {
        actor: user.name || "Admin",
        action: `${action.toUpperCase()}_TIME_STUDY`,
        entityType: "TIME_STUDY",
        entityId: res?.id || data?.id || "unknown",
        details: `${user.name || "Admin"} ${action} time study`,
      });

      return res;
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/time-study error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
