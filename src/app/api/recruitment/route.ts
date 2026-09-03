import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Route entity keys -> Prisma model names (client exposes camelCase model names only).
const ENTITY_MODELS: Record<string, string> = {
  requisitions: "jobRequisition",
  candidates: "candidate",
  interviews: "interview",
  onboardingTasks: "onboardingTask",
};

const ENTITY_FIELDS: Record<string, string[]> = {
  requisitions: [
    "title",
    "department",
    "openings",
    "location",
    "status",
    "postedAt",
    "notes",
  ],
  candidates: [
    "requisitionId",
    "name",
    "email",
    "phone",
    "stage",
    "source",
    "appliedAt",
    "notes",
  ],
  interviews: [
    "candidateId",
    "scheduledAt",
    "interviewType",
    "panelist",
    "feedback",
    "status",
  ],
  onboardingTasks: ["candidateId", "task", "dueDate", "done", "notes"],
};

const NUMERIC_FIELDS = new Set(["openings"]);
const DATE_FIELDS = new Set([
  "postedAt",
  "appliedAt",
  "scheduledAt",
  "dueDate",
]);

function coerce(fields: string[], data: any): any {
  const out: any = {};
  for (const f of fields) {
    if (data[f] === undefined) continue;
    const val = data[f];
    if (NUMERIC_FIELDS.has(f))
      out[f] = val === "" || val == null ? 0 : Number(val);
    else if (DATE_FIELDS.has(f)) {
      if (val) out[f] = new Date(val);
    } // skip empty so @default(now()) applies
    else if (f === "done") out[f] = Boolean(val);
    else out[f] = val === "" ? null : val;
  }
  return out;
}

async function requireEdit(user: any) {
  if (
    !user.isOwner &&
    !canAny(user, ["people.edit", "system.edit", "ops.edit"])
  ) {
    return false;
  }
  return true;
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["people.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [requisitions, candidates, interviews, onboardingTasks] =
      await Promise.all([
        prisma.jobRequisition.findMany({
          orderBy: { postedAt: "desc" },
          include: { _count: { select: { candidates: true } } },
        }),
        prisma.candidate.findMany({
          orderBy: { appliedAt: "desc" },
          include: {
            requisition: { select: { title: true } },
            _count: { select: { interviews: true } },
          },
        }),
        prisma.interview.findMany({
          orderBy: { scheduledAt: "desc" },
          include: { candidate: { select: { name: true } } },
        }),
        prisma.onboardingTask.findMany({
          orderBy: [{ done: "asc" }, { dueDate: "asc" }],
          include: { candidate: { select: { name: true } } },
        }),
      ]);
    return NextResponse.json({
      requisitions,
      candidates,
      interviews,
      onboardingTasks,
    });
  } catch (error) {
    console.error("GET /api/recruitment error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!(await requireEdit(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { entity, action, data } = body;
    if (!entity || !action || !data) {
      return NextResponse.json(
        { error: "Missing entity, action or data" },
        { status: 400 },
      );
    }

    let result: any;

    if (action === "moveStage") {
      result = await prisma.candidate.update({
        where: { id: data.id },
        data: { stage: data.stage },
      });
    } else if (action === "toggleTask") {
      result = await prisma.onboardingTask.update({
        where: { id: data.id },
        data: { done: Boolean(data.done) },
      });
    } else {
      if (!ENTITY_FIELDS[entity] || !ENTITY_MODELS[entity]) {
        return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
      }
      const model = (prisma as any)[ENTITY_MODELS[entity]];
      if (action === "create") {
        result = await model.create({
          data: coerce(ENTITY_FIELDS[entity], data),
        });
      } else if (action === "update") {
        if (!data.id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        result = await model.update({
          where: { id: data.id },
          data: coerce(ENTITY_FIELDS[entity], data),
        });
      } else if (action === "delete") {
        if (!data.id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        result = await model.delete({ where: { id: data.id } });
      } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
    }

    await logAudit({
      actor: user.name || "Admin",
      action: `${action.toUpperCase()}_${(entity || "RECRUITMENT").toUpperCase()}`,
      entityType: (entity || "RECRUITMENT").toUpperCase(),
      entityId: result?.id || data?.id || "unknown",
      details: `${user.name || "Admin"} ${action} on ${entity || "recruitment"}`,
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/recruitment error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
