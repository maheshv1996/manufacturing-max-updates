import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
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

    const newCampaign = await prisma.testCampaign.create({
      data: {
        campaignNumber,
        title,
        status: "PLANNED",
        testCostRupees: testCostRupees || 0,
        workOrderId,
      },
    });

    await logAudit({
      actor: "system",
      action: "RND_CAMPAIGN_CREATED",
      entityType: "TestCampaign",
      entityId: newCampaign.id,
      details: `${campaignNumber} · ${title} · wo=${workOrderId}`,
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
