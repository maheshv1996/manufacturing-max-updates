import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { getComplianceFlags } from "@/lib/complianceDigest";
import {
  computeCalibrationStatus,
  computeVendorStatus,
} from "@/lib/calibration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["system.view", "ops.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const { flags, criticalCount, warningCount } =
      await getComplianceFlags(now);

    const [calibratedToolsDb, specialProcessVendorsDb, logs] =
      await Promise.all([
        prisma.calibratedTool.findMany(),
        prisma.specialProcessVendor.findMany(),
        prisma.complianceDigestLog.findMany({
          orderBy: { generatedAt: "desc" },
          take: 10,
        }),
      ]);

    const calibrationStats = {
      expiredCount: calibratedToolsDb.filter(
        (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRED",
      ).length,
      expiringCount: calibratedToolsDb.filter(
        (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRING_SOON",
      ).length,
    };
    const specialProcessStats = {
      expiredVendorsCount: specialProcessVendorsDb.filter(
        (v) => computeVendorStatus(v.expiresAt) === "EXPIRED",
      ).length,
    };

    const [openNcrCount, pendingEcoCount, lowStockCount] = await Promise.all([
      (prisma as any).ncrReport.count({ where: { status: "OPEN" } }),
      prisma.eco.count({ where: { status: "DRAFT" } }),
      (prisma as any).rawMaterial
        .findMany({ where: { isActive: true } })
        .then(
          (mats: any[]) =>
            mats.filter((m) => m.currentStock <= m.minStock).length,
        ),
    ]);

    return NextResponse.json({
      generatedAt: now.toISOString(),
      flags,
      counts: { criticalCount, warningCount },
      calibrationStats,
      specialProcessStats,
      quality: { openNcrCount, pendingEcoCount, lowStockCount },
      logs,
    });
  } catch (error) {
    console.error("GET /api/compliance/digest error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
