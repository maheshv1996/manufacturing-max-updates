import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Employee self-service: any authenticated user can read their OWN payslips
 * (matched by employeeNumber → SalaryStructure.employeeCode, falling back to
 * display name). No people.view required — this is the ESS surface.
 */
export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { employeeNumber: true, name: true },
    });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const structures = await prisma.salaryStructure.findMany({
      where: {
        OR: [
          ...(me.employeeNumber
            ? [{ employeeCode: me.employeeNumber }]
            : []),
          { employeeName: { equals: me.name, mode: "insensitive" as any } },
        ],
      },
      select: { id: true, employeeName: true, employeeCode: true, designation: true },
    });

    if (structures.length === 0) {
      return NextResponse.json({ success: true, slips: [], me });
    }

    const slips = await prisma.payslip.findMany({
      where: { salaryStructureId: { in: structures.map((s) => s.id) } },
      orderBy: [{ month: "desc" }],
      take: 60,
      include: { salaryStructure: true },
    });

    return NextResponse.json({ success: true, slips, me });
  } catch (error) {
    console.error("GET /api/people/payslips error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}