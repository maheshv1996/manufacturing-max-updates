import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["quality.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;
    const actor = user.name || user.id || "Admin";

    if (action === "reorder") {
      const { items } = body; // Array of { id, seq }
      if (!Array.isArray(items)) {
        return NextResponse.json({ error: "Items array is required" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.fiveSItem.update({
            where: { id: item.id },
            data: { seq: item.seq },
          });
        }

        await logAuditTx(tx, {
          actor,
          action: "5S_ITEMS_REORDERED",
          entityType: "FiveSItem",
          details: `reordered ${items.length} items`,
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === "create") {
      const { category, text } = body;
      if (!category || !text) {
        return NextResponse.json({ error: "Category and text are required" }, { status: 400 });
      }

      const newItem = await prisma.$transaction(async (tx) => {
        const count = await tx.fiveSItem.count({ where: { category } });
        const created = await tx.fiveSItem.create({
          data: {
            category,
            seq: count + 1,
            text,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "5S_ITEM_CREATED",
          entityType: "FiveSItem",
          entityId: created.id,
          details: `${category} · ${text}`,
        });

        return created;
      });

      return NextResponse.json(newItem);
    }

    if (action === "update") {
      const { id, category, text } = body;
      if (!id) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      const updatedItem = await prisma.$transaction(async (tx) => {
        const updated = await tx.fiveSItem.update({
          where: { id },
          data: {
            category,
            text,
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "5S_ITEM_UPDATED",
          entityType: "FiveSItem",
          entityId: id,
          details: `${category || "unchanged"} · ${text || "unchanged"}`,
        });

        return updated;
      });

      return NextResponse.json(updatedItem);
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.fiveSItem.delete({ where: { id } });

        await logAuditTx(tx, {
          actor,
          action: "5S_ITEM_DELETED",
          entityType: "FiveSItem",
          entityId: id,
          details: `deleted item ${id}`,
        });
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Admin 5S items API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
