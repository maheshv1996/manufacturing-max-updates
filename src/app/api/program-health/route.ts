import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { computeProgramHealth } from "@/lib/programHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (
      !user ||
      (!user.isOwner &&
        !can(user, "projects.view") &&
        !can(user, "commercial.view") &&
        !can(user, "exec.view"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const programs = await computeProgramHealth();
    const atRisk = programs.filter((p) => p.risk !== "LOW");
    const highRisk = programs.filter((p) => p.risk === "HIGH");

    return NextResponse.json({ programs, atRisk, highRisk });
  } catch (error: any) {
    console.error("GET /api/program-health error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
