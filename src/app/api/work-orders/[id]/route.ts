import { NextResponse } from "next/server";
import { getWorkOrderDetailData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const workOrder = await getWorkOrderDetailData(id);

    if (!workOrder) {
      return NextResponse.json(
        { error: "Work Order not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(workOrder);
  } catch (error) {
    console.error("Error fetching work order detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch work order detail" },
      { status: 500 },
    );
  }
}
