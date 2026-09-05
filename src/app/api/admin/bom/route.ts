import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";

export async function GET() {
  try {
    const [products, rawMaterials] = await Promise.all([
      prisma.product.findMany({
        include: {
          bomLines: {
            include: {
              rawMaterial: {
                include: { supplier: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        } as any,
        orderBy: { name: "asc" },
      }),
      prisma.rawMaterial.findMany({
        where: { isActive: true },
        include: { supplier: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ products, rawMaterials });
  } catch (error) {
    console.error("Error fetching BOM data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "engineering.edit") && !can(user, "ops.edit") && !can(user, "system.edit"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const actorName = user.name || headersList.get("x-user-name") || "Admin";

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action } = body;
    const db = prisma as any;

    if (action === "ADD_LINE") {
      const { productId, rawMaterialId, qtyPerUnit } = body;

      if (
        !productId ||
        !rawMaterialId ||
        qtyPerUnit === undefined ||
        parseFloat(qtyPerUnit) <= 0
      ) {
        return NextResponse.json(
          { error: "Invalid parameters for BOM line" },
          { status: 400 },
        );
      }

      // Check for existing line
      const existing = await db.bomLine.findUnique({
        where: {
          productId_rawMaterialId: {
            productId,
            rawMaterialId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            error:
              "BOM line for this material already exists on product. Please edit the existing line instead.",
          },
          { status: 400 },
        );
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId },
      });

      const newLine = await db.$transaction(async (tx: any) => {
        const created = await tx.bomLine.create({
          data: {
            productId,
            rawMaterialId,
            qtyPerUnit: parseFloat(qtyPerUnit),
          },
          include: {
            rawMaterial: true,
            product: true,
          },
        });

        await logAuditTx(tx, {
          actor: actorName,
          action: "BOM_LINE_ADDED",
          entityType: "BOM_LINE",
          entityId: created.id,
          details: `Added BOM line to ${product?.name || "Product"}: ${qtyPerUnit} ${rawMaterial?.unit || "units"} of ${rawMaterial?.name || "Material"}`,
        });

        return created;
      });

      return NextResponse.json({ success: true, line: newLine });
    }

    if (action === "EDIT_LINE") {
      const { lineId, qtyPerUnit } = body;

      if (!lineId || qtyPerUnit === undefined || parseFloat(qtyPerUnit) <= 0) {
        return NextResponse.json(
          { error: "Invalid parameters for editing BOM line" },
          { status: 400 },
        );
      }

      const existingLine = await db.bomLine.findUnique({
        where: { id: lineId },
        include: { product: true, rawMaterial: true },
      });

      if (!existingLine) {
        return NextResponse.json(
          { error: "BOM line not found" },
          { status: 404 },
        );
      }

      const updatedLine = await db.$transaction(async (tx: any) => {
        const updated = await tx.bomLine.update({
          where: { id: lineId },
          data: {
            qtyPerUnit: parseFloat(qtyPerUnit),
          },
          include: {
            rawMaterial: true,
            product: true,
          },
        });

        await logAuditTx(tx, {
          actor: actorName,
          action: "BOM_LINE_UPDATED",
          entityType: "BOM_LINE",
          entityId: lineId,
          details: `Updated BOM line for ${existingLine.product?.name}: changed ${existingLine.rawMaterial?.name} qty per unit from ${existingLine.qtyPerUnit} to ${qtyPerUnit}`,
        });

        return updated;
      });

      return NextResponse.json({ success: true, line: updatedLine });
    }

    if (action === "DELETE_LINE") {
      const { lineId } = body;

      if (!lineId) {
        return NextResponse.json({ error: "Missing lineId" }, { status: 400 });
      }

      const existingLine = await db.bomLine.findUnique({
        where: { id: lineId },
        include: { product: true, rawMaterial: true },
      });

      if (!existingLine) {
        return NextResponse.json(
          { error: "BOM line not found" },
          { status: 404 },
        );
      }

      await db.$transaction(async (tx: any) => {
        await tx.bomLine.delete({
          where: { id: lineId },
        });

        await logAuditTx(tx, {
          actor: actorName,
          action: "BOM_LINE_DELETED",
          entityType: "BOM_LINE",
          entityId: lineId,
          details: `Deleted BOM line from ${existingLine.product?.name}: removed ${existingLine.rawMaterial?.name}`,
        });
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("BOM API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
