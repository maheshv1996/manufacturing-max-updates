import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "reorder") {
      const { items } = body; // Array of { id, seq }
      for (const item of items) {
        await prisma.fiveSItem.update({
          where: { id: item.id },
          data: { seq: item.seq },
        });
      }

      await logAudit({
        actor: "system",
        action: "5S_ITEMS_REORDERED",
        entityType: "FiveSItem",
        details: `reordered ${items.length} items`,
      });

      return NextResponse.json({ success: true });
    }

    if (action === "create") {
      const { category, text } = body;
      const count = await prisma.fiveSItem.count({ where: { category } });
      const newItem = await prisma.fiveSItem.create({
        data: {
          category,
          seq: count + 1,
          text,
        },
      });

      await logAudit({
        actor: "system",
        action: "5S_ITEM_CREATED",
        entityType: "FiveSItem",
        entityId: newItem.id,
        details: `${category} · ${text}`,
      });

      return NextResponse.json(newItem);
    }

    if (action === "update") {
      const { id, category, text } = body;
      const updatedItem = await prisma.fiveSItem.update({
        where: { id },
        data: {
          category,
          text,
        },
      });

      await logAudit({
        actor: "system",
        action: "5S_ITEM_UPDATED",
        entityType: "FiveSItem",
        entityId: id,
        details: `${category} · ${text}`,
      });

      return NextResponse.json(updatedItem);
    }

    if (action === "delete") {
      const { id } = body;
      await prisma.fiveSItem.delete({ where: { id } });

      await logAudit({
        actor: "system",
        action: "5S_ITEM_DELETED",
        entityType: "FiveSItem",
        entityId: id,
        details: `deleted item ${id}`,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Admin 5S items API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
