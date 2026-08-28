import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { editSourceRecord } from "@/lib/sourceRecordEdit";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const userName = headersList.get("x-user-name") || "Admin";

    if (
      !user.isOwner &&
      !can(user, "system.edit") &&
      !user.isOwner &&
      !can(user, "ops.edit")
    ) {
      return NextResponse.json(
        { error: "Unauthorized. Admin/Supervisor permission required." },
        { status: 403 },
      );
    }

    const body = await request.json();
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

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (error: any) {
    console.error("Error editing source record:", error);
    return NextResponse.json(
      { error: error.message || "Failed to edit source record" },
      { status: 500 },
    );
  }
}
