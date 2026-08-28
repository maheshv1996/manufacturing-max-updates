import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const ecos = await prisma.eco.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(ecos);
  } catch (error) {
    console.error("GET /api/eco error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ECOs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      effectivityType,
      effectivityValue,
      raisedBy = "Engineering",
    } = body;

    // Generate ECO number
    const year = new Date().getFullYear();
    const count = await prisma.eco.count({
      where: { ecoNumber: { startsWith: `ECO-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, "0");
    const ecoNumber = `ECO-${year}-${seq}`;

    const eco = await prisma.eco.create({
      data: {
        ecoNumber,
        title,
        description,
        effectivityType: effectivityType || "DATE",
        effectivityValue,
        raisedBy,
        status: "DRAFT",
      },
    });

    revalidatePath("/eco");
    await logAudit({
      actor: "system",
      action: "ECO_CREATED",
      entityType: "Eco",
      entityId: eco.id,
      details: `${ecoNumber} · ${title}`,
    });
    return NextResponse.json({ success: true, eco });
  } catch (error) {
    console.error("POST /api/eco error:", error);
    return NextResponse.json(
      { error: "Failed to create ECO" },
      { status: 500 },
    );
  }
}
