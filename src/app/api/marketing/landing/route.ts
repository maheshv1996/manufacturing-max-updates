import { NextResponse } from "next/server";
import { getLandingContent } from "../route";

export const dynamic = "force-dynamic";

// Public endpoint — powers the unauthenticated /landing page.
export async function GET() {
  try {
    const landing = await getLandingContent();
    return NextResponse.json({ landing });
  } catch (error) {
    console.error("GET /api/marketing/landing error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
