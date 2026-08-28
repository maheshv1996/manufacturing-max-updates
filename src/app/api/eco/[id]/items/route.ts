import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EcoAction, EcoEntityType } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { entityType, productId, action, newData, notes } = body;

    const item = await prisma.ecoItem.create({
      data: {
        ecoId: id,
        entityType: entityType as EcoEntityType,
        productId,
        action: action as EcoAction,
        newData,
        notes,
      },
    });

    revalidatePath(`/eco/${id}`);
    await logAudit({
      actor: "system",
      action: "ECO_ITEM_ADDED",
      entityType: "EcoItem",
      entityId: item.id,
      details: `ecoId=${id} · ${action} · ${entityType}${productId ? ` · product=${productId}` : ""}`,
    });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST /api/eco/[id]/items error:", error);
    return NextResponse.json(
      { error: "Failed to add ECO item" },
      { status: 500 },
    );
  }
}
