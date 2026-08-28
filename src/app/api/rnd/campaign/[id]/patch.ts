import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
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

    return NextResponse.json({ success: true, campaign: updatedCampaign });
  } catch (error) {
    console.error(`PATCH /api/rnd/campaign/${params?.id} error:`, error);
    return NextResponse.json(
      { error: "Failed to update test campaign" },
      { status: 500 },
    );
  }
}
