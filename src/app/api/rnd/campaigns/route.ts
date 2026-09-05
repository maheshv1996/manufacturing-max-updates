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
    if (!user.isOwner && !canAny(user, ["engineering.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId, title, testCostRupees } = body;

    if (!workOrderId || !title) {
      return NextResponse.json(
        { error: "workOrderId and title are required" },
        { status: 400 },
      );
    }

    const campaignNumber = `TC-${new Date().getFullYear()}-${Math.floor(
      Math.random() * 1000,
    )
      .toString()
      .padStart(3, "0")}`;
    const actor = user.name || user.id || "Operator";

    const newCampaign = await prisma.$transaction(async (tx) => {
      const created = await tx.testCampaign.create({
        data: {
          campaignNumber,
          title,
          status: "PLANNED",
          testCostRupees: testCostRupees || 0,
          workOrderId,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "RND_CAMPAIGN_CREATED",
        entityType: "TestCampaign",
        entityId: created.id,
        details: `${campaignNumber} · ${title} · wo=${workOrderId}`,
      });

      return created;
    });

    return NextResponse.json(
      { success: true, campaign: newCampaign },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/rnd/campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 },
    );
  }
}
