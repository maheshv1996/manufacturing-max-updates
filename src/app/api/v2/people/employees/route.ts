import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createEmployee } from "@/lib/people/peopleTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  employeeNumber: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  designation: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  panNumber: z.string().trim().max(10).optional(),
  aadhaarNumber: z.string().trim().max(12).optional(),
  pfUan: z.string().trim().max(12).optional(),
  esiNumber: z.string().trim().max(17).optional(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "people.edit")) throw forbidden("people.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    await createEmployee(prisma, { id: user.id, name: user.name }, a);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "people.view")) throw forbidden("people.view required");

    const employees = await prisma.employee.findMany({
      orderBy: { employeeNumber: "asc" },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        designation: true,
        department: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, employees });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
