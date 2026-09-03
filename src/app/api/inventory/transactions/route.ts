import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      include: {
        rawMaterial: { select: { name: true, sku: true, unit: true } },
      },
      orderBy: { at: "desc" },
      take: 50,
    });

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error("GET /api/inventory/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}
