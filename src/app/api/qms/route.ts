import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Route entity keys -> Prisma model names (client exposes camelCase model names only).
const ENTITY_MODELS: Record<string, string> = {
  audits: "qmsAudit",
  findings: "qmsAuditFinding",
};

const ENTITY_FIELDS: Record<string, string[]> = {
  audits: [
    "auditNumber",
    "title",
    "standard",
    "auditType",
    "auditor",
    "auditeeDept",
    "scheduledDate",
    "completedAt",
    "status",
    "result",
    "notes",
  ],
  findings: [
    "auditId",
    "clause",
    "description",
    "severity",
    "status",
    "correctiveAction",
    "ncrId",
    "dueDate",
  ],
};

const DATE_FIELDS = new Set(["scheduledDate", "completedAt", "dueDate"]);

function coerce(fields: string[], data: any): any {
  const out: any = {};
  for (const f of fields) {
    if (data[f] === undefined) continue;
    const val = data[f];
    if (DATE_FIELDS.has(f)) {
      if (val) out[f] = new Date(val);
    } // skip empty so @default(now()) applies
    else out[f] = val === "" ? null : val;
  }
  return out;
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["system.view", "ops.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [audits, ncrs] = await Promise.all([
      prisma.qmsAudit.findMany({
        orderBy: { scheduledDate: "desc" },
        include: { findings: true },
      }),
      prisma.ncrReport.findMany({
        select: { id: true, ncrNumber: true, status: true },
        orderBy: { raisedAt: "desc" },
        take: 200,
      }),
    ]);
    return NextResponse.json({ audits, ncrs });
  } catch (error) {
    console.error("GET /api/qms error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["system.edit", "ops.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { entity, action, data } = body;
    if (!entity || !action || !data) {
      return NextResponse.json(
        { error: "Missing entity, action or data" },
        { status: 400 },
      );
    }

    let result: any;

    if (action === "completeAudit") {
      result = await prisma.qmsAudit.update({
        where: { id: data.id },
        data: {
          status: "COMPLETED",
          result: data.result || null,
          completedAt: new Date(),
          notes: data.notes !== undefined ? data.notes : undefined,
        },
      });
    } else {
      if (!ENTITY_FIELDS[entity] || !ENTITY_MODELS[entity]) {
        return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
      }
      const model = (prisma as any)[ENTITY_MODELS[entity]];
      if (action === "create") {
        const payload = coerce(ENTITY_FIELDS[entity], data);
        if (entity === "audits" && !payload.auditNumber) {
          const count = await prisma.qmsAudit.count();
          const year = new Date().getFullYear();
          payload.auditNumber = `AUD-${year}-${String(count + 1).padStart(3, "0")}`;
        }
        result = await model.create({ data: payload });
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
      action: `${action.toUpperCase()}_${entity.toUpperCase()}`,
      entityType: entity.toUpperCase(),
      entityId: result?.id || data?.id || "unknown",
      details: `${user.name || "Admin"} ${action} on ${entity}`,
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/qms error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
