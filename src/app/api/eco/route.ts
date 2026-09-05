import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { EcoEffectivityType } from "@prisma/client";

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
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["engineering.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const title = typeof body.title === "string" ? body.title : "";
    const description = typeof body.description === "string" ? body.description : "";
    const effectivityType = (typeof body.effectivityType === "string" ? body.effectivityType : "DATE") as EcoEffectivityType;
    const effectivityValue = typeof body.effectivityValue === "string" ? body.effectivityValue : "IMMEDIATE";
    const actor = user.name || user.id || "Engineering";

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const year = new Date().getFullYear();
    const count = await prisma.eco.count({
      where: { ecoNumber: { startsWith: `ECO-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, "0");
    const ecoNumber = `ECO-${year}-${seq}`;

    const eco = await prisma.$transaction(async (tx) => {
      const created = await tx.eco.create({
        data: {
          ecoNumber,
          title,
          description,
          effectivityType,
          effectivityValue,
          raisedBy: actor,
          status: "DRAFT",
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "ECO_CREATED",
        entityType: "Eco",
        entityId: created.id,
        details: `${ecoNumber} · ${title}`,
      });

      return created;
    });

    revalidatePath("/eco");
    return NextResponse.json({ success: true, eco });
  } catch (error) {
    console.error("POST /api/eco error:", error);
    return NextResponse.json(
      { error: "Failed to create ECO" },
      { status: 500 },
    );
  }
}
