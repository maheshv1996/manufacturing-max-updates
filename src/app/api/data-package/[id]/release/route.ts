import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { fetchLiveDossierData } from "@/lib/dataPackageLiveFetch";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "ops.edit") && !can(user, "quality.edit") && !can(user, "system.edit"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const releasedBy = user.name || body.releasedBy || "System";

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

    // Update package atomically with audit log
    const updatedPackage = await prisma.$transaction(async (tx) => {
      const updated = await tx.dataPackage.update({
        where: { id },
        data: {
          status: "RELEASED",
          snapshot: liveData as any,
          releasedBy,
          releasedAt: new Date(),
        },
      });

      await logAuditTx(tx, {
        action: "DATA_PACKAGE_RELEASED",
        actor: releasedBy,
        details: `Released Data Package ${updated.packageNumber}`,
        entityType: "WorkOrder",
        entityId: updated.workOrderId,
      });

      return updated;
    });

    return NextResponse.json({ success: true, dataPackage: updatedPackage });
  } catch (error: any) {
    console.error("Error releasing data package:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
