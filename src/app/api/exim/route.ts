import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const DATE_KEYS = [
  "bookingDate",
  "sailingDate",
  "customsClearDate",
  "arrivalDate",
];
const DOC_KEYS = ["docCi", "docPl", "docCoO", "docBl"];
const TEXT_KEYS = ["vesselName", "voyageNo", "blNumber"];

export async function GET() {
  try {
    const shipments = await prisma.eximShipment.findMany({
      orderBy: { shipmentDate: "desc" },
      take: 500,
    });
    const total = shipments.length;
    const inTransit = shipments.filter((s) => s.status === "IN_TRANSIT").length;
    const cleared = shipments.filter((s) => s.status === "CLEARED").length;
    const delivered = shipments.filter((s) => s.status === "DELIVERED").length;
    const docsComplete = shipments.filter(
      (s) => s.docCi && s.docPl && s.docCoO && s.docBl,
    ).length;
    return NextResponse.json({
      shipments,
      stats: { total, inTransit, cleared, delivered, docsComplete },
    });
  } catch (error) {
    console.error("GET /api/exim error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.isOwner &&
      !canAny(user, ["commercial.edit", "commercial.view"])
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, id, data } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing shipment id" },
        { status: 400 },
      );
    }

    const existing = await prisma.eximShipment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }

    if (action === "update_milestones") {
      const patch: Record<string, any> = {};
      for (const k of TEXT_KEYS) {
        if (data && data[k] !== undefined)
          patch[k] = data[k] === "" ? null : data[k];
      }
      for (const k of DATE_KEYS) {
        if (data && data[k] !== undefined)
          patch[k] = data[k] ? new Date(data[k]) : null;
      }
      for (const k of DOC_KEYS) {
        if (data && data[k] !== undefined) patch[k] = Boolean(data[k]);
      }
      const updated = await prisma.eximShipment.update({
        where: { id },
        data: patch,
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "EXIM_MILESTONES_UPDATED",
        entityType: "EXIM_SHIPMENT",
        entityId: id,
        details: `Updated milestones for ${existing.shipmentNumber} (vessel: ${patch.vesselName || "—"}, sailing: ${patch.sailingDate ? new Date(patch.sailingDate).toLocaleDateString() : "—"}, docs: CI ${patch.docCi ? "✓" : "✗"} / PL ${patch.docPl ? "✓" : "✗"} / CoO ${patch.docCoO ? "✓" : "✗"} / BL ${patch.docBl ? "✓" : "✗"})`,
      });
      return NextResponse.json({ success: true, shipment: updated });
    }

    if (action === "advance_status") {
      const allowed: Record<string, string> = {
        BOOKED: "IN_TRANSIT",
        IN_TRANSIT: "CLEARED",
        CLEARED: "DELIVERED",
      };
      const next = allowed[existing.status];
      if (!next) {
        return NextResponse.json(
          { error: `Cannot advance from ${existing.status}` },
          { status: 400 },
        );
      }
      const updated = await prisma.eximShipment.update({
        where: { id },
        data: { status: next as string },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "EXIM_STATUS_ADVANCED",
        entityType: "EXIM_SHIPMENT",
        entityId: id,
        details: `${existing.shipmentNumber}: ${existing.status} → ${next}`,
      });
      return NextResponse.json({ success: true, shipment: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/exim error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
