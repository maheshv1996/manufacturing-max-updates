import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenStr = cookieStore.get("app_session")?.value;
    const token = tokenStr ? await verifySessionToken(tokenStr) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.id },
      select: { prefs: true },
    });

    return NextResponse.json({ prefs: user?.prefs || null });
  } catch (error) {
    console.error("Error fetching prefs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const tokenStr = cookieStore.get("app_session")?.value;
    const token = tokenStr ? await verifySessionToken(tokenStr) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const user = await prisma.user.update({
      where: { id: token.id },
      data: { prefs: body },
    });

    await logAudit({
      actor: token.id,
      action: "PREFS_UPDATED",
      entityType: "User",
      entityId: token.id,
      details: `keys=${Object.keys(body || {}).join(",")}`,
    });

    return NextResponse.json({ success: true, prefs: user.prefs });
  } catch (error) {
    console.error("Error updating prefs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
