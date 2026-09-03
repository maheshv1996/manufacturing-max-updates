import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  colorTone: z.enum(["blue","emerald","amber","rose","violet","cyan","slate"]).optional().nullable(),
  fields: z.array(z.object({
    key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(100),
    fieldType: z.enum(["text","number","date","select","boolean"]),
    required: z.boolean().optional().default(false),
    options: z.array(z.string()).optional().nullable(),
    placeholder: z.string().max(100).optional().nullable(),
  })).min(1).max(20).optional(),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || `entity_${Date.now()}`;
}

export async function GET() {
  const entities = await (prisma as any).customEntity.findMany({
    include: { fields: { orderBy: { sortOrder: "asc" } }, _count: { select: { records: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ entities });
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id || (!user.isOwner && !can(user, "system.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  // Minimal guard + zod
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = parseOr400(createSchema, body);
  if (!parsed.ok) return parsed.response;
  const { title, description, icon, colorTone, fields } = parsed.data as any;
  const slug = body.slug ? slugify(String(body.slug)) : slugify(title);

  const existing = await (prisma as any).customEntity.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: `Entity slug "${slug}" already exists` }, { status: 409 });

  const entity = await prisma.$transaction(async (tx) => {
    const created = await (tx as any).customEntity.create({
      data: {
        slug,
        title: title.trim(),
        description: description?.trim() || null,
        icon: icon || null,
        colorTone: colorTone || null,
        createdBy: user.name || user.id,
      },
    });
    if (fields && Array.isArray(fields)) {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await (tx as any).customField.create({
          data: {
            entityId: created.id,
            key: f.key,
            label: f.label,
            fieldType: f.fieldType,
            required: !!f.required,
            options: f.options || null,
            placeholder: f.placeholder || null,
            sortOrder: i,
          },
        });
      }
    }
    return await (tx as any).customEntity.findUnique({
      where: { id: created.id },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
  });

  await (prisma as any).auditLog.create({
    data: {
      actor: user.name || user.id,
      action: "CUSTOM_ENTITY_CREATED",
      entityType: "CustomEntity",
      entityId: entity.id,
      details: `Created custom entity ${slug} (${title}) with ${fields?.length || 0} fields`,
    },
  });

  return NextResponse.json({ entity }, { status: 201 });
}
