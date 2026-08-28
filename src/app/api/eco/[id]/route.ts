import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EcoStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const eco = await prisma.eco.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!eco) {
      return NextResponse.json({ error: "ECO not found" }, { status: 404 });
    }

    return NextResponse.json(eco);
  } catch (error) {
    console.error("GET /api/eco/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch ECO" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, approvedBy } = body;

    const data: any = {};
    if (status) {
      data.status = status as EcoStatus;
      if (status === "APPROVED") {
        data.approvedBy = approvedBy || "Engineering Manager";
        data.approvedAt = new Date();
      }
    }

    const eco = await prisma.eco.update({
      where: { id },
      data,
    });

    revalidatePath("/eco");
    revalidatePath(`/eco/${id}`);
    await logAudit({
      actor: "system",
      action: "ECO_STATUS_UPDATED",
      entityType: "Eco",
      entityId: id,
      details: `status=${status ?? "unchanged"} · approvedBy=${data.approvedBy ?? "-"}`,
    });
    return NextResponse.json({ success: true, eco });
  } catch (error) {
    console.error("PUT /api/eco/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update ECO" },
      { status: 500 },
    );
  }
}
