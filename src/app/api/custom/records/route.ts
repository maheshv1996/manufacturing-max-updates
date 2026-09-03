import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

function buildZodForFields(fields: any[]) {
  const shape: Record<string, any> = {};
  for (const f of fields) {
    let schema: any;
    switch (f.fieldType) {
      case "text": schema = z.string().max(500); break;
      case "number": schema = z.coerce.number().finite(); break;
      case "date": schema = z.string().min(1); break; // ISO string
      case "select": schema = z.string().min(1); if (f.options?.length) schema = z.enum(f.options as [string, ...string[]]); break;
      case "boolean": schema = z.coerce.boolean(); break;
      default: schema = z.string();
    }
    if (!f.required) schema = schema.optional().nullable();
    shape[f.key] = schema;
  }
  return z.object(shape);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const entityId = searchParams.get("entityId");
  let entity: any = null;
  if (slug) entity = await (prisma as any).customEntity.findUnique({ where: { slug }, include: { fields: true } });
  else if (entityId) entity = await (prisma as any).customEntity.findUnique({ where: { id: entityId }, include: { fields: true } });
  else return NextResponse.json({ error: "slug or entityId required" }, { status: 400 });
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  const records = await (prisma as any).customRecord.findMany({ where: { entityId: entity.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ entity, records });
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Any ops/engineering user can create records; system.edit not required for data entry
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "engineering.view") && !can(user, "system.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { slug, entityId, values } = body as any;
  if (!values || typeof values !== "object") return NextResponse.json({ error: "values object required" }, { status: 400 });
  let entity: any = null;
  if (slug) entity = await (prisma as any).customEntity.findUnique({ where: { slug }, include: { fields: true } });
  else if (entityId) entity = await (prisma as any).customEntity.findUnique({ where: { id: entityId }, include: { fields: true } });
  else return NextResponse.json({ error: "slug or entityId required" }, { status: 400 });
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

  const schema = buildZodForFields(entity.fields);
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Optional Flow hook: if entity has a Flow that watches this creation, it would fire here
  // For the vertical slice, we just create the record; Flow engine can later subscribe to CustomRecord created events.
  const record = await (prisma as any).customRecord.create({
    data: {
      entityId: entity.id,
      values: parsed.data,
      createdBy: user.name || user.id,
    },
  });

  await (prisma as any).auditLog.create({
    data: {
      actor: user.name || user.id,
      action: "CUSTOM_RECORD_CREATED",
      entityType: "CustomRecord",
      entityId: record.id,
      details: `Custom record for ${entity.slug}: ${JSON.stringify(parsed.data).slice(0, 500)}`,
    },
  });

  // Flow hook placeholder: e.g., Titanium Blisk Cell wear > 90% → NCR
  // This is where AutomationFlow would be evaluated (future: automationEngine.evaluateFlows({ trigger: "CustomRecord.created", entitySlug: entity.slug, values: parsed.data }))

  return NextResponse.json({ record }, { status: 201 });
}
