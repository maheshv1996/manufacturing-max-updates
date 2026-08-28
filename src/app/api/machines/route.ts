import { NextResponse } from "next/server";
import { getMachinesData } from "@/lib/data";
import { parseDateRange } from "@/lib/date-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const parsedRange = parseDateRange({ range });
    const { machines } = await getMachinesData(parsedRange);
    return NextResponse.json(machines);
  } catch (error: any) {
    console.error("Error fetching machines:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch machines" },
      { status: 500 },
    );
  }
}
