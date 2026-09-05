import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.view", "quality.view", "system.view"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { documentId, title, version, productName, operatorName, woNumber } =
      body;

    const actor = operatorName || user.name || user.id || "Operator";

    await prisma.$transaction(async (tx) => {
      await logAuditTx(tx, {
        actor,
        action: "DRAWING_VIEWED",
        entityType: "DOCUMENT",
        entityId: documentId || "UNKNOWN",
        details: `Operator viewed '${title || "Drawing"}' (REV ${version || 1}) for product '${productName || "N/A"}' on Work Order ${woNumber || "N/A"}`,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging drawing view audit:", error);
    return NextResponse.json({ error: "Failed to log audit" }, { status: 500 });
  }
}
