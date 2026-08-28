import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const campaign = await prisma.testCampaign.findUnique({
      where: { id },
      include: {
        records: {
          orderBy: { createdAt: "asc" },
        },
        workOrder: {
          include: {
            project: true,
            product: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Test Campaign not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error(`GET /api/rnd/campaign/${id} error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch test campaign" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 },
      );
    }

    const updatedCampaign = await prisma.testCampaign.update({
      where: { id },
      data: { status },
    });

    await logAudit({
      actor: "system",
      action: "RND_CAMPAIGN_STATUS_CHANGED",
      entityType: "TestCampaign",
      entityId: id,
      details: `status → ${status}`,
    });

    return NextResponse.json({ success: true, campaign: updatedCampaign });
  } catch (error) {
    console.error(`PATCH /api/rnd/campaign/${id} error:`, error);
    return NextResponse.json(
      { error: "Failed to update test campaign" },
      { status: 500 },
    );
  }
}
