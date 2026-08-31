import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLiveDossierData } from "@/lib/dataPackageLiveFetch";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
    await logAudit({ actor: "system", action: "DATA_PACKAGE_RELEASED", entityType: "WorkOrderDataPackage", details: "Data package released" });
  try {
    const { id } = await params;
    const body = await request.json();
    const { releasedBy = "System" } = body;

    const dataPackage = await prisma.dataPackage.findUnique({
      where: { id },
    });

    if (!dataPackage) {
      return NextResponse.json(
        { error: "Data package not found" },
        { status: 404 },
      );
    }

    if (dataPackage.status === "RELEASED") {
      return NextResponse.json(
        { error: "Data package is already released" },
        { status: 400 },
      );
    }

    // Fetch the live data snapshot
    const liveData = await fetchLiveDossierData(dataPackage.workOrderId);

    if (!liveData) {
      return NextResponse.json(
        { error: "Failed to compile live data snapshot" },
        { status: 500 },
      );
    }

    // Update package
    const updatedPackage = await prisma.dataPackage.update({
      where: { id },
      data: {
        status: "RELEASED",
        snapshot: liveData as any,
        releasedBy,
        releasedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "DATA_PACKAGE_RELEASED",
        actor: releasedBy,
        details: `Released Data Package ${updatedPackage.packageNumber}`,
        entityType: "WorkOrder",
        entityId: updatedPackage.workOrderId,
      },
    });

    return NextResponse.json({ success: true, dataPackage: updatedPackage });
  } catch (error: any) {
    console.error("Error releasing data package:", error);
    return NextResponse.json(
      { error: error.message || "Failed to release data package" },
      { status: 500 },
    );
  }
}
