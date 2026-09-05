import { logAuditTx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const furnaces = [
    {
      id: "FURN-01",
      name: "Ipsen High-Vacuum Annealing Furnace",
      classType: "CLASS_2",
      classDesc: "Class 2 (± 6°C / ± 10°F Tolerance)",
      tempRange: "400°C to 1200°C",
      lastTusDate: "2026-06-15",
      nextTusDueDate: new Date(Date.now() + 25 * 86400000).toISOString().split("T")[0],
      satFrequency: "BI_WEEKLY",
      lastSatDeltaDegC: 1.2,
      maxAllowedDeltaDegC: 2.0,
      thermocoupleCalibrationCert: "TC-CAL-9982-NABL",
      status: "COMPLIANT",
    },
    {
      id: "FURN-02",
      name: "Seco/Warwick Aging & Tempering Oven",
      classType: "CLASS_1",
      classDesc: "Class 1 (± 3°C / ± 5°F High Precision)",
      tempRange: "150°C to 650°C",
      lastTusDate: "2026-07-01",
      nextTusDueDate: new Date(Date.now() + 85 * 86400000).toISOString().split("T")[0],
      satFrequency: "WEEKLY",
      lastSatDeltaDegC: 0.8,
      maxAllowedDeltaDegC: 1.1,
      thermocoupleCalibrationCert: "TC-CAL-9940-NABL",
      status: "COMPLIANT",
    },
  ];

  return NextResponse.json({ success: true, furnaces });
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["quality.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const furnaceId = typeof body.furnaceId === "string" ? body.furnaceId : "Furnace";
    const actor = user.name || user.id || "Quality Inspector";

    await prisma.$transaction(async (tx) => {
      await logAuditTx(tx, {
        actor,
        action: "PYROMETRY_RECORDED",
        entityType: "PyrometryLog",
        details: `Pyrometry TUS survey logged for ${furnaceId}`,
      });
    });

    return NextResponse.json({ success: true, message: "Pyrometry TUS logged", record: body });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
