import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

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
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !user.isOwner &&
    !canAny(user, ["quality.view", "system.view", "ops.view"])
  ) {
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
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !user.isOwner &&
    !canAny(user, ["quality.edit", "system.edit", "ops.edit"])
  ) {
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

    const result = await prisma.$transaction(async (tx) => {
      let res: any;
      if (action === "completeAudit") {
        res = await tx.qmsAudit.update({
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
          throw new Error("UNKNOWN_ENTITY");
        }
        const model = (tx as any)[ENTITY_MODELS[entity]];
        if (action === "create") {
          const payload = coerce(ENTITY_FIELDS[entity], data);
          if (entity === "audits" && !payload.auditNumber) {
            const count = await tx.qmsAudit.count();
            const year = new Date().getFullYear();
            payload.auditNumber = `AUD-${year}-${String(count + 1).padStart(3, "0")}`;
          }
          res = await model.create({ data: payload });
        } else if (action === "update") {
          if (!data.id) throw new Error("MISSING_ID");
          res = await model.update({
            where: { id: data.id },
            data: coerce(ENTITY_FIELDS[entity], data),
          });
        } else if (action === "delete") {
          if (!data.id) throw new Error("MISSING_ID");
          res = await model.delete({ where: { id: data.id } });
        } else {
          throw new Error("INVALID_ACTION");
        }
      }

      await logAuditTx(tx, {
        actor: user.name || "Admin",
        action: `${action.toUpperCase()}_${entity.toUpperCase()}`,
        entityType: entity.toUpperCase(),
        entityId: res?.id || data?.id || "unknown",
        details: `${user.name || "Admin"} ${action} on ${entity}`,
      });

      return res;
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error: any) {
    if (error?.message === "UNKNOWN_ENTITY") {
      return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
    }
    if (error?.message === "MISSING_ID") {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (error?.message === "INVALID_ACTION") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    console.error("POST /api/qms error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
