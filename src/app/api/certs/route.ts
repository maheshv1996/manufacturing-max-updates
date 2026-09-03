import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const certs = await (prisma as any).materialCert.findMany({
      include: {
        inventoryTransaction: {
          select: { id: true, at: true, batchNo: true, qty: true },
        },
        rawMaterial: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        supplier: {
          select: { id: true, name: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const expiringSoon = certs.filter(
      (c: any) =>
        c.expiresAt &&
        new Date(c.expiresAt) <= in30Days &&
        new Date(c.expiresAt) >= now,
    );

    return NextResponse.json({ certs, expiringSoon });
  } catch (error: any) {
    console.error("GET /api/certs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch certs" },
      { status: 500 },
    );
  }
}
