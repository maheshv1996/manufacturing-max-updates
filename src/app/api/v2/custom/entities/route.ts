import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import {
  createCustomEntityTx,
  getCustomEntitiesTx,
} from "@/lib/custom/customTx";

export const dynamic = "force-dynamic";

const fieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(100),
  fieldType: z.enum(["text", "number", "date", "select", "boolean"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional().nullable(),
  placeholder: z.string().optional().nullable(),
  defaultValue: z.unknown().optional(),
  sortOrder: z.number().int().optional(),
});

const createEntitySchema = z.object({
  title: z.string().min(1).max(100),
  slug: z.string().max(64).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(64).optional().nullable(),
  colorTone: z.string().max(32).optional().nullable(),
  fields: z.array(fieldSchema).optional(),
});

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "system.view") && !can(user, "ops.view"))) {
      throw forbidden("system.view or ops.view permission required");
    }

    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("activeOnly") === "true";

    const entities = await getCustomEntitiesTx(prisma, { activeOnly });
    return NextResponse.json({ entities });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN"
        ? 403
        : api.error === "NOT_FOUND"
          ? 404
          : api.error === "VALIDATION"
            ? 422
            : 400;
    return NextResponse.json(api, { status });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "system.edit")) {
      throw forbidden("system.edit permission required");
    }

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createEntitySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const entity = await createCustomEntityTx(
      prisma,
      parsed.value,
      { id: user.id, name: user.name || "Admin" },
    );

    return NextResponse.json({ entity }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN"
        ? 403
        : api.error === "NOT_FOUND"
          ? 404
          : api.error === "CONFLICT"
            ? 409
            : api.error === "VALIDATION"
              ? 422
              : 400;
    return NextResponse.json(api, { status });
  }
}
