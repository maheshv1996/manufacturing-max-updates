import { logAudit } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { editSourceRecord } from "@/lib/sourceRecordEdit";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const userName = headersList.get("x-user-name") || user.name || "Admin";

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !user.isOwner &&
      !can(user, "system.edit") &&
      !can(user, "ops.edit")
    ) {
      return NextResponse.json(
        { error: "Forbidden. Admin/Supervisor permission required." },
        { status: 403 },
      );
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { entityType, entityId, updates, reason } = body;

    if (!entityType || !entityId || !updates) {
      return NextResponse.json(
        { error: "Missing required fields: entityType, entityId, updates" },
        { status: 400 },
      );
    }

    const updatedRecord = await editSourceRecord({
      entityType,
      entityId,
      updates,
      editorName: userName,
      reason,
    });

    await logAudit({
      actor: user.name || userName,
      action: "SOURCE_RECORD_EDITED",
      entityType,
      entityId,
      details: `Edited ${entityType} ${entityId}: ${reason || "Admin edit"}`,
    });

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (error: any) {
    console.error("Error editing source record:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
