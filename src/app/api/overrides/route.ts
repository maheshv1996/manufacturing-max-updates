import { logAudit } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getOverrides, setOverride, clearOverride } from "@/lib/overrideEngine";
import {
  requireManagerLevel,
  validateReason,
  auditDecision,
} from "@/lib/managerGate";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const entityId = searchParams.get("entityId") || undefined;

    const overrides = await getOverrides(entityType, entityId);
    return NextResponse.json({ overrides });
  } catch (error: any) {
    console.error("Failed to fetch overrides:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
    await logAudit({ actor: "system", action: "OVERRIDE_RECORDED", entityType: "SupervisorOverride", details: "Supervisor override recorded" });
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const userName = headersList.get("x-user-name") || "Admin";

    if (
      !user.isOwner &&
      !can(user, "system.edit") &&
      !can(user, "kpi.override")
    ) {
      return NextResponse.json(
        { error: "Unauthorized. Admin role required to set overrides." },
        { status: 403 },
      );
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { entityType, entityId, field, value } = body;

    if (!entityType || !entityId || !field || value === undefined) {
      return NextResponse.json(
        {
          error: "Missing required fields: entityType, entityId, field, value",
        },
        { status: 400 },
      );
    }

    // Overrides are decisions — department-head level + a reason, always.
    const gate = await requireManagerLevel(user);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 });
    }
    const reasonCheck = validateReason(body);
    if (!reasonCheck.ok) {
      return NextResponse.json({ error: reasonCheck.error }, { status: 400 });
    }

    const override = await setOverride({
      entityType,
      entityId,
      field,
      value: Number(value),
      note: reasonCheck.reason,
      byName: userName,
    });

    await auditDecision({
      actor: userName,
      action: "KPI",
      entityType: entityType.toUpperCase(),
      entityId,
      reason: reasonCheck.reason || "",
      override: true,
    });

    return NextResponse.json({ success: true, override });
  } catch (error: any) {
    console.error("Failed to set override:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    await logAudit({ actor: "system", action: "OVERRIDE_RECORDED", entityType: "SupervisorOverride", details: "Supervisor override recorded" });
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const userName = headersList.get("x-user-name") || "Admin";

    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json(
        { error: "Unauthorized. Admin role required to clear overrides." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const field = searchParams.get("field");

    if (!entityType || !entityId || !field) {
      return NextResponse.json(
        { error: "Missing required query params: entityType, entityId, field" },
        { status: 400 },
      );
    }

    await clearOverride(entityType, entityId, field, userName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to clear override:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
