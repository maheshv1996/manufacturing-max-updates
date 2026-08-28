import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        workOrders: {
          include: {
            testCampaigns: {
              include: {
                records: true,
              },
              orderBy: { campaignNumber: "desc" },
            },
            product: true,
          },
          orderBy: { iteration: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error(`GET /api/rnd/${id} error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 },
    );
  }
}
