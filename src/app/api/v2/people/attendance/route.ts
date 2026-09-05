import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, validation } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { computeAttendanceStats } from "@/lib/people/peopleTx";

export const dynamic = "force-dynamic";

const clockSchema = z.object({
  userId: z.string().trim().min(1),
  clockIn: z.string().datetime(),
  clockOut: z.string().datetime().optional(),
  status: z.enum(["PRESENT", "LATE"]).default("PRESENT"),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "people.edit")) throw forbidden("people.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(clockSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const data = parsed.value;

    // Fail-closed: clock against a real shift, never a hardcoded id.
    const shift = await prisma.shift.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (!shift) throw validation("No active shift configured — cannot clock attendance");

    const log = await prisma.attendanceLog.create({
      data: {
        userId: data.userId,
        shiftId: shift.id,
        clockIn: new Date(data.clockIn),
        clockOut: data.clockOut ? new Date(data.clockOut) : null,
        status: data.status,
      },
    });

    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "people.view")) throw forbidden("people.view required");

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;

    const logs = await prisma.attendanceLog.findMany({
      where,
      orderBy: { clockIn: "asc" },
    });

    const stats = userId
      ? await computeAttendanceStats(
          logs.map((l) => ({
            userId: l.userId,
            clockIn: l.clockIn,
            clockOut: l.clockOut,
            status: l.status as "PRESENT" | "LATE",
          })),
          userId,
          year,
          month,
        )
      : null;

    return NextResponse.json({ success: true, logs, stats });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
