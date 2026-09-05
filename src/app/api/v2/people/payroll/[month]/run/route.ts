import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { runPayrollForMonth } from "@/lib/people/peopleTx";
import { computeAttendance } from "@/lib/people/attendance";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "people.edit")) throw forbidden("people.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const { year, month } = parsed.value;

    const employees = await prisma.salaryStructure.findMany();
    const attendanceMap = new Map();

    // AttendanceLog.userId is the User cuid; SalaryStructure.employeeCode joins via
    // User.employeeNumber (the badge join key). Resolve users once, then filter logs.
    const users = await prisma.user.findMany({
      where: { employeeNumber: { in: employees.map((e) => e.employeeCode) } },
      select: { id: true, employeeNumber: true },
    });
    const userIdByCode = new Map(users.map((u) => [u.employeeNumber ?? "", u.id]));

    for (const emp of employees) {
      const uid = userIdByCode.get(emp.employeeCode);
      if (!uid) continue; // no linked user → no attendance to feed payroll

      const logs = await prisma.attendanceLog.findMany({
        where: {
          userId: uid,
          clockIn: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
      });

      const result = computeAttendance(
        logs.map((l) => ({
          userId: l.userId,
          clockIn: l.clockIn,
          clockOut: l.clockOut,
          status: l.status,
        })),
        uid,
        year,
        month,
      );

      if (result.tag === "ok") {
        attendanceMap.set(emp.employeeCode, result.value);
      }
    }

    await runPayrollForMonth(
      prisma,
      { id: user.id, name: user.name },
      year,
      month,
      employees.map((e) => ({
        employeeCode: e.employeeCode,
        employeeName: e.employeeName,
        basicPay: e.basicPay,
        hra: e.hra,
        specialAllowance: e.specialAllowance,
        conveyance: e.conveyance,
        otherAllowance: e.otherAllowance,
        pfPercent: e.pfPercent,
        professionalTax: e.professionalTax,
      })),
      attendanceMap,
      {
        otDailyThresholdHours: 8,
        otMultiplier: 2,
        laborRatePerHour: 150,
        pfPercent: 12,
        esiThreshold: 21000,
        professionalTax: 200,
      },
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
