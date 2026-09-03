import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, ["ehs.view", "ehs.edit", "system.edit"]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const consents = await prisma.consent.findMany({
      orderBy: [{ type: "asc" }, { validUntil: "desc" }],
    });
    const now = Date.now();
    const DAY = 86400000;
    const enriched = consents.map((c) => {
      const daysLeft = Math.ceil(
        (new Date(c.validUntil).getTime() - now) / DAY,
      );
      const status =
        daysLeft < 0 ? "EXPIRED" : daysLeft <= 90 ? "EXPIRING" : "VALID";
      return { ...c, daysLeft, renewalStatus: status };
    });
    const stats = {
      water: enriched.filter((c) => c.type === "WATER").length,
      air: enriched.filter((c) => c.type === "AIR").length,
      expiring: enriched.filter((c) => c.renewalStatus === "EXPIRING").length,
      expired: enriched.filter((c) => c.renewalStatus === "EXPIRED").length,
    };
    return NextResponse.json({ consents: enriched, stats });
  } catch (error) {
    console.error("GET /api/consents error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = user.name || "Admin";
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["ehs.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager or ehs.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-consent") {
      const { type, boardRef, validUntil, issuedAt, notes } = data;
      if (!type || !["WATER", "AIR"].includes(type))
        return NextResponse.json(
          { error: "type must be WATER or AIR" },
          { status: 400 },
        );
      if (!boardRef || !validUntil)
        return NextResponse.json(
          { error: "boardRef and validUntil required" },
          { status: 400 },
        );
      const consentNumber = await nextSeqNumber(
        "consent",
        "consentNumber",
        "CON",
      );
      result = await prisma.consent.create({
        data: {
          consentNumber,
          type,
          boardRef,
          validUntil: new Date(validUntil),
          issuedAt: issuedAt ? new Date(issuedAt) : null,
          notes: notes || null,
          status: new Date(validUntil) < new Date() ? "EXPIRED" : "ACTIVE",
        },
      });
      await logAudit({
        actor,
        action: "CONSENT_CREATED",
        entityType: "CONSENT",
        entityId: result.id,
        details: `${consentNumber} · ${type} · ${boardRef}`,
      });
    } else if (action === "renew-consent") {
      const c = await prisma.consent.findUnique({ where: { id: data.id } });
      if (!c)
        return NextResponse.json(
          { error: "Consent not found" },
          { status: 404 },
        );
      if (!data.validUntil)
        return NextResponse.json(
          { error: "validUntil required for renewal" },
          { status: 400 },
        );
      result = await prisma.consent.update({
        where: { id: c.id },
        data: {
          validUntil: new Date(data.validUntil),
          boardRef: data.boardRef || c.boardRef,
          issuedAt: data.issuedAt ? new Date(data.issuedAt) : new Date(),
          notes: data.notes !== undefined ? data.notes : c.notes,
          status: new Date(data.validUntil) < new Date() ? "EXPIRED" : "ACTIVE",
        },
      });
      await logAudit({
        actor,
        action: "CONSENT_RENEWED",
        entityType: "CONSENT",
        entityId: c.id,
        details: `${c.consentNumber} · ${c.type} · valid until ${new Date(result.validUntil).toISOString().slice(0, 10)}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/consents error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
