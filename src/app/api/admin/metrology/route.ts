import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import {
  computeCalibrationStatus,
  computeVendorStatus,
  effectiveLocation,
  nextCalibrationDue,
} from "@/lib/calibration";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isOwner && !can(user, "system.edit") && !can(user, "quality.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [tools, vendors] = await Promise.all([
      prisma.calibratedTool.findMany({
        include: {
          issues: { orderBy: { issuedAt: "desc" }, take: 5 },
        },
        orderBy: { expiresAt: "asc" },
      }),
      prisma.specialProcessVendor.findMany({ orderBy: { expiresAt: "asc" } }),
    ]);

    // Always serve live-computed status so expired items surface immediately
    const calibratedTools = tools.map((t) => ({
      ...t,
      status: computeCalibrationStatus(t.expiresAt),
      location: effectiveLocation(t),
      nextDue: nextCalibrationDue(t.calibratedAt, t.calibrationIntervalDays),
      openIssue: t.issues.find((i) => !i.returnedAt) || null,
    }));
    const specialProcessVendors = vendors.map((v) => ({
      ...v,
      status: computeVendorStatus(v.expiresAt),
    }));

    return NextResponse.json({ calibratedTools, specialProcessVendors });
  } catch (error) {
    console.error("Failed to fetch metrology data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
