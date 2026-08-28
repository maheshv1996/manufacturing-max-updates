import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "MOTION",
  "WAIT",
  "OVERPROCESS",
  "INVENTORY",
  "DEFECT",
  "TRANSPORT",
  "OVERPRODUCTION",
];

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user || (!user.isOwner && !can(user, "ops.view"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [observations, implemented] = await Promise.all([
      prisma.leanObservation.findMany({
        orderBy: { observedAt: "desc" },
        take: 100,
      }),
      prisma.leanObservation.findMany({ where: { status: "IMPLEMENTED" } }),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthObs = observations.filter(
      (o) => new Date(o.observedAt) >= monthStart,
    );
    const monthImplemented = implemented.filter(
      (o) => new Date(o.implementedAt || o.observedAt) >= monthStart,
    );

    const byCategory: Record<string, number> = {};
    CATEGORIES.forEach((c) => (byCategory[c] = 0));
    observations.forEach((o) => {
      byCategory[o.category] = (byCategory[o.category] || 0) + 1;
    });

    return NextResponse.json({
      observations,
      stats: {
        total: observations.length,
        open: observations.filter((o) => o.status === "OPEN").length,
        implemented: implemented.length,
        monthMinutes: monthObs.reduce((s, o) => s + o.estMinutesSaved, 0),
        monthHours:
          Math.round(
            (monthObs.reduce((s, o) => s + o.estMinutesSaved, 0) / 60) * 10,
          ) / 10,
        monthImplementedCount: monthImplemented.length,
        byCategory,
      },
    });
  } catch (error: any) {
    console.error("GET /api/lean-observations error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Operator";
    const user = getUserFromHeaders(headerList);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const { title, area, category, description, estMinutesSaved } = body;
      if (!title || !area || !category || !estMinutesSaved) {
        return NextResponse.json(
          { error: "title, area, category and estMinutesSaved required" },
          { status: 400 },
        );
      }
      if (!CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: `Unknown waste category: ${category}` },
          { status: 400 },
        );
      }
      const obs = await prisma.leanObservation.create({
        data: {
          title,
          area,
          category,
          description: description || null,
          estMinutesSaved: Number(estMinutesSaved),
          observedBy: actor,
        },
      });
      await logAudit({
        actor,
        action: "IE_OBSERVATION",
        entityType: "LEAN_OBSERVATION",
        entityId: obs.id,
        details: `IE observation \"${title}\" — est ${estMinutesSaved} min/shift saved (${category})`,
      });
      return NextResponse.json({ observation: obs }, { status: 201 });
    }

    if (action === "implement") {
      const { id } = body;
      if (!id)
        return NextResponse.json({ error: "id required" }, { status: 400 });
      if (!user.isOwner && !can(user, "ops.edit")) {
        return NextResponse.json(
          { error: "Insufficient role: ops.edit required to mark implemented" },
          { status: 403 },
        );
      }
      const obs = await prisma.leanObservation.update({
        where: { id },
        data: {
          status: "IMPLEMENTED",
          implementedAt: new Date(),
          implementedBy: actor,
        },
      });
      await logAudit({
        actor,
        action: "IE_OBSERVATION_IMPLEMENTED",
        entityType: "LEAN_OBSERVATION",
        entityId: id,
        details: `Implemented IE observation \"${obs.title}\" (${obs.estMinutesSaved} min/shift)`,
      });
      return NextResponse.json({ observation: obs });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("POST /api/lean-observations error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
