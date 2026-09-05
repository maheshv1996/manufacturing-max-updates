import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EcoAction, EcoEntityType } from "@prisma/client";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["engineering.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { entityType, productId, action, newData, notes } = body;
    if (!entityType || !action || !productId) {
      return NextResponse.json(
        { error: "entityType, action and productId are required" },
        { status: 400 },
      );
    }

    const actor = user.name || user.id || "Engineer";

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.ecoItem.create({
        data: {
          ecoId: id,
          entityType: entityType as EcoEntityType,
          productId: productId as string,
          action: action as EcoAction,
          newData: typeof newData === "string" ? newData : undefined,
          notes: typeof notes === "string" ? notes : undefined,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "ECO_ITEM_ADDED",
        entityType: "EcoItem",
        entityId: created.id,
        details: `ecoId=${id} · ${action} · ${entityType}${productId ? ` · product=${productId}` : ""}`,
      });

      return created;
    });

    revalidatePath(`/eco/${id}`);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST /api/eco/[id]/items error:", error);
    return NextResponse.json(
      { error: "Failed to add ECO item" },
      { status: 500 },
    );
  }
}
