import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const DATE_FIELDS = ["rcExpiryDate", "insuranceExpiryDate", "fitnessExpiryDate", "permitExpiryDate"];

const updateSchema = z.object({
  make: z.string().max(80).optional().nullable(),
  model: z.string().max(80).optional().nullable(),
  type: z.string().max(40).optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  fuelType: z.string().max(30).optional().nullable(),
  capacity: z.string().max(60).optional().nullable(),
  assignedDriver: z.string().max(120).optional().nullable(),
  rcExpiryDate: z.string().optional().nullable(),
  insuranceExpiryDate: z.string().optional().nullable(),
  fitnessExpiryDate: z.string().optional().nullable(),
  permitExpiryDate: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "IN_SERVICE", "OUT_OF_SERVICE", "SOLD"]).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "supply.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(updateSchema, body);
    if (!parsed.ok) return parsed.response;

    const data: any = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      data[k] = DATE_FIELDS.includes(k) ? (v ? new Date(String(v)) : null) : v === "" ? null : v;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.update({ where: { id }, data });

    await logAudit({
      actor,
      action: "VEHICLE_UPDATED",
      entityType: "Vehicle",
      entityId: id,
      details: `Updated ${vehicle.registrationNumber}: ${Object.keys(data).join(", ")}`,
    });

    return NextResponse.json({ success: true, vehicle });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    console.error("PATCH /api/supply/vehicles/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}