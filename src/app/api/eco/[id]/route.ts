import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EcoStatus } from "@prisma/client";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

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
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["engineering.edit", "engineering.approve", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const status = typeof body.status === "string" ? (body.status as EcoStatus) : undefined;
    const actor = user.name || user.id || "Engineering Manager";

    const data: Record<string, unknown> = {};
    if (status) {
      data.status = status;
      if (status === "APPROVED") {
        data.approvedBy = typeof body.approvedBy === "string" ? body.approvedBy : actor;
        data.approvedAt = new Date();
      }
    }

    const eco = await prisma.$transaction(async (tx) => {
      const updated = await tx.eco.update({
        where: { id },
        data,
      });

      await logAuditTx(tx, {
        actor,
        action: "ECO_STATUS_UPDATED",
        entityType: "Eco",
        entityId: id,
        details: `status=${status ?? "unchanged"} · approvedBy=${(data.approvedBy as string) ?? "-"}`,
      });

      return updated;
    });

    revalidatePath("/eco");
    revalidatePath(`/eco/${id}`);
    return NextResponse.json({ success: true, eco });
  } catch (error) {
    console.error("PUT /api/eco/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update ECO" },
      { status: 500 },
    );
  }
}
