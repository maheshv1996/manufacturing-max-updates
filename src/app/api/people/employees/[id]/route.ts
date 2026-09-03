import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, isActive: true } } },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, employee });
  } catch (error) {
    console.error("GET /api/people/employees/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  designation: z.string().max(120).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  doj: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
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
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(updateSchema, body);
    if (!parsed.ok) return parsed.response;

    const d = parsed.data as any;
    const data: any = {};
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue;
      if (k === "doj" || k === "dob") data[k] = v ? new Date(String(v)) : null;
      else data[k] = v === "" ? null : v;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });

    await logAudit({
      actor,
      action: "EMPLOYEE_UPDATED",
      entityType: "Employee",
      entityId: id,
      details: `Updated employee ${employee.employeeNumber} ${employee.name}: ${Object.keys(data).join(", ")}`,
    });

    return NextResponse.json({ success: true, employee });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    console.error("PATCH /api/people/employees/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["exit", "reactivate"]),
  reason: z.string().max(1000).optional().nullable(),
  exitDate: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(actionSchema, body);
    if (!parsed.ok) return parsed.response;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const exiting = parsed.data.action === "exit";
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        status: exiting ? "EXITED" : "ACTIVE",
        exitDate: exiting
          ? parsed.data.exitDate
            ? new Date(parsed.data.exitDate)
            : new Date()
          : null,
        exitReason: exiting ? parsed.data.reason || null : null,
      },
    });

    await logAudit({
      actor,
      action: exiting ? "EMPLOYEE_EXITED" : "EMPLOYEE_REACTIVATED",
      entityType: "Employee",
      entityId: id,
      details: `${employee.employeeNumber} ${employee.name} ${exiting ? "exited" : "reactivated"}${parsed.data.reason ? " — " + parsed.data.reason.slice(0, 120) : ""}`,
      severity: exiting ? "WARN" : "INFO",
    });

    return NextResponse.json({ success: true, employee: updated });
  } catch (error) {
    console.error("POST /api/people/employees/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}