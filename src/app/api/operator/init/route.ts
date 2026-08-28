import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCalibrationStatus } from "@/lib/calibration";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [
      operators,
      machines,
      shifts,
      downtimeReasons,
      defectCodes,
      calibratedTools,
    ] = await Promise.all([
      prisma.user.findMany({
        // Both 'Operator' (onboarding flow) and 'OPERATOR' (full seed) exist
        // depending on how the DB was provisioned — match either.
        where: { role: { name: { in: ["Operator", "OPERATOR"] } } },
        orderBy: { name: "asc" },
      }),
      prisma.machine.findMany({
        include: {
          line: {
            include: { plant: true },
          },
        },
        orderBy: { code: "asc" },
      }),
      prisma.shift.findMany({
        orderBy: { startTime: "asc" },
      }),
      prisma.downtimeReason.findMany({
        orderBy: { category: "asc" },
      }),
      prisma.defectCode.findMany({
        orderBy: { code: "asc" },
      }),
      prisma.calibratedTool.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      operators,
      machines,
      shifts,
      downtimeReasons,
      defectCodes,
      calibratedTools: calibratedTools.map((t) => ({
        ...t,
        status: computeCalibrationStatus(t.expiresAt),
      })),
    });
  } catch (error) {
    console.error("Error initializing operator tablet data:", error);
    return NextResponse.json(
      { error: "Failed to load operator tablet data" },
      { status: 500 },
    );
  }
}
