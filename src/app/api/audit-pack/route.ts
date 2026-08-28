import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { buildAuditPack } from "@/lib/auditPack";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await buildAuditPack());
  } catch (error) {
    console.error("GET /api/audit-pack error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
