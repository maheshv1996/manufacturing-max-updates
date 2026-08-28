import { NextResponse } from "next/server";
import { collectHealth } from "@/lib/serverHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await collectHealth();
  return NextResponse.json(payload);
}
