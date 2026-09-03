import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

function expiryStatus(d: Date | null): "OK" | "EXPIRING" | "EXPIRED" | "NA" {
  if (!d) return "NA";
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  if (days < 0) return "EXPIRED";
  if (days <= 60) return "EXPIRING";
  return "OK";
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "supply.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const vehicles = await prisma.vehicle.findMany({ orderBy: { registrationNumber: "asc" } });
    const withFlags = vehicles.map((v) => ({
      ...v,
      rc: expiryStatus(v.rcExpiryDate),
      insurance: expiryStatus(v.insuranceExpiryDate),
      fitness: expiryStatus(v.fitnessExpiryDate),
      permit: expiryStatus(v.permitExpiryDate),
      nextExpiry: [v.rcExpiryDate, v.insuranceExpiryDate, v.fitnessExpiryDate, v.permitExpiryDate]
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime())[0] || null,
    }));

    const flagged = withFlags.filter(
      (v) => v.rc === "EXPIRING" || v.insurance === "EXPIRING" || v.fitness === "EXPIRING" || v.permit === "EXPIRING",
    ).length;
    const expired = withFlags.filter(
      (v) => v.rc === "EXPIRED" || v.insurance === "EXPIRED" || v.fitness === "EXPIRED" || v.permit === "EXPIRED",
    ).length;

    return NextResponse.json({
      success: true,
      vehicles: withFlags,
      stats: { total: vehicles.length, flagged, expired, active: vehicles.filter((v) => v.status === "ACTIVE").length },
    });
  } catch (error) {
    console.error("GET /api/supply/vehicles error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const createSchema = z.object({
  registrationNumber: z
    .string()
    .min(1)
    .max(30)
    .transform((s) => s.trim().toUpperCase()),
  make: z.string().max(80).optional().nullable(),
  model: z.string().max(80).optional().nullable(),
  type: z.string().max(40).optional().default("FOUR_WHEELER"),
  year: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  fuelType: z.string().max(30).optional().nullable(),
  capacity: z.string().max(60).optional().nullable(),
  assignedDriver: z.string().max(120).optional().nullable(),
  rcExpiryDate: z.string().optional().nullable(),
  insuranceExpiryDate: z.string().optional().nullable(),
  fitnessExpiryDate: z.string().optional().nullable(),
  permitExpiryDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "supply.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const parsed = parseOr400(createSchema, body);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const existing = await prisma.vehicle.findUnique({
      where: { registrationNumber: d.registrationNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Vehicle ${d.registrationNumber} already registered` },
        { status: 400 },
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: d.registrationNumber,
        make: d.make || null,
        model: d.model || null,
        type: d.type,
        year: d.year || null,
        fuelType: d.fuelType || null,
        capacity: d.capacity || null,
        assignedDriver: d.assignedDriver || null,
        rcExpiryDate: d.rcExpiryDate ? new Date(d.rcExpiryDate) : null,
        insuranceExpiryDate: d.insuranceExpiryDate ? new Date(d.insuranceExpiryDate) : null,
        fitnessExpiryDate: d.fitnessExpiryDate ? new Date(d.fitnessExpiryDate) : null,
        permitExpiryDate: d.permitExpiryDate ? new Date(d.permitExpiryDate) : null,
        notes: d.notes || null,
      },
    });

    await logAudit({
      actor,
      action: "VEHICLE_REGISTERED",
      entityType: "Vehicle",
      entityId: vehicle.id,
      details: `Registered ${vehicle.registrationNumber}${vehicle.make ? " " + vehicle.make : ""}${vehicle.model ? " " + vehicle.model : ""}`,
    });

    return NextResponse.json({ success: true, vehicle });
  } catch (error) {
    console.error("POST /api/supply/vehicles error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}