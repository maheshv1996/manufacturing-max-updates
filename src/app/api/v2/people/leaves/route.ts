import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import type { LeaveType } from "@prisma/client";

export const dynamic = "force-dynamic";

// API leave vocabulary → Prisma LeaveType (schema enum). Typed mapping, no casts.
const API_LEAVE_TYPES = ["CASUAL", "SICK", "PRIVILEGE", "EARNED", "MATERNITY", "PATERNITY", "COMP_OFF"] as const;
type ApiLeaveType = (typeof API_LEAVE_TYPES)[number];

const bodySchema = z.object({
  userId: z.string().trim().min(1),
  type: z.enum(API_LEAVE_TYPES),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  days: z.number().positive(),
  reason: z.string().trim().min(1).max(1000),
});

const LEAVE_TYPE_MAP: Record<ApiLeaveType, LeaveType> = {
  CASUAL: "CL",
  SICK: "SL",
  PRIVILEGE: "PL",
  EARNED: "PL",
  MATERNITY: "MATERNITY",
  PATERNITY: "PATERNITY",
  COMP_OFF: "COMP_OFF",
};

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "people.edit")) throw forbidden("people.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const data = parsed.value;

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: data.userId,
        type: LEAVE_TYPE_MAP[data.type],
        fromDate: new Date(data.fromDate),
        toDate: new Date(data.toDate),
        days: data.days,
        reason: data.reason,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, leave }, { status: 201 });
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

    const leaves = await prisma.leaveRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, employeeNumber: true } },
        approvedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, leaves });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
