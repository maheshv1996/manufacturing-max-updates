import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [employees, byStatus] = await Promise.all([
      prisma.employee.findMany({
        orderBy: [{ status: "asc" }, { name: "asc" }],
        take: 500,
        include: { user: { select: { id: true, username: true, isActive: true } } },
      }),
      prisma.employee.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      employees,
      stats: {
        total: employees.length,
        active: byStatus.find((s) => s.status === "ACTIVE")?._count._all || 0,
        onHold: byStatus.find((s) => s.status === "ON_HOLD")?._count._all || 0,
        exited: byStatus.find((s) => s.status === "EXITED")?._count._all || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/people/employees error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const employeeFields = [
  "employeeNumber",
  "name",
  "designation",
  "department",
  "doj",
  "dob",
  "gender",
  "phone",
  "email",
  "panNumber",
  "aadhaarNumber",
  "pfUan",
  "esiNumber",
  "bankName",
  "bankAccountNumber",
  "bankIfsc",
  "address",
  "bloodGroup",
  "emergencyContact",
] as const;

const createEmployeeSchema = z.object({
  employeeNumber: z
    .string()
    .min(1)
    .max(50)
    .transform((s) => s.trim()),
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  designation: z.string().max(120).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  doj: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  aadhaarNumber: z.string().max(20).optional().nullable(),
  pfUan: z.string().max(30).optional().nullable(),
  esiNumber: z.string().max(30).optional().nullable(),
  bankName: z.string().max(120).optional().nullable(),
  bankAccountNumber: z.string().max(40).optional().nullable(),
  bankIfsc: z.string().max(20).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  emergencyContact: z.string().max(200).optional().nullable(),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const parsed = parseOr400(createEmployeeSchema, body);
    if (!parsed.ok) return parsed.response;

    const d = parsed.data;
    const existing = await prisma.employee.findUnique({
      where: { employeeNumber: d.employeeNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Employee ${d.employeeNumber} already exists (${existing.name}).` },
        { status: 400 },
      );
    }

    // Auto-link to the matching User row (badge culture) when it exists.
    const linkedUser = await prisma.user.findUnique({
      where: { employeeNumber: d.employeeNumber },
      select: { id: true },
    });

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: d.employeeNumber,
        name: d.name,
        userId: linkedUser?.id || null,
        designation: d.designation || null,
        department: d.department || null,
        doj: d.doj ? new Date(d.doj) : null,
        dob: d.dob ? new Date(d.dob) : null,
        gender: d.gender || null,
        phone: d.phone || null,
        email: d.email || null,
        panNumber: d.panNumber || null,
        aadhaarNumber: d.aadhaarNumber || null,
        pfUan: d.pfUan || null,
        esiNumber: d.esiNumber || null,
        bankName: d.bankName || null,
        bankAccountNumber: d.bankAccountNumber || null,
        bankIfsc: d.bankIfsc || null,
        address: d.address || null,
        bloodGroup: d.bloodGroup || null,
        emergencyContact: d.emergencyContact || null,
        createdBy: actor,
      },
    });

    await logAudit({
      actor,
      action: "EMPLOYEE_CREATED",
      entityType: "Employee",
      entityId: employee.id,
      details: `Created employee ${employee.employeeNumber} ${employee.name}${linkedUser ? " (linked to user)" : ""}`,
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    console.error("POST /api/people/employees error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}