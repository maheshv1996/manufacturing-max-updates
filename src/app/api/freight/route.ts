import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [vendors, dispatches] = await Promise.all([
      prisma.freightVendor.findMany({
        include: { dispatches: true },
        orderBy: { name: "asc" },
        take: 300,
      }),
      prisma.freightDispatch.findMany({
        include: { vendor: true },
        orderBy: [{ status: "asc" }, { promisedDate: "asc" }],
        take: 500,
      }),
    ]);

    const scorecards = vendors.map((v) => {
      const ds = v.dispatches || [];
      const delivered = ds.filter((d) => d.status === "DELIVERED");
      const onTime = delivered.filter(
        (d) =>
          d.actualDate &&
          d.promisedDate &&
          new Date(d.actualDate) <= new Date(d.promisedDate),
      );
      const onTimePct =
        delivered.length > 0
          ? Math.round((onTime.length / delivered.length) * 100)
          : null;
      const avgLead =
        delivered.length > 0
          ? parseFloat(
              (
                delivered.reduce((a, d) => {
                  if (!d.actualDate || !d.pickupDate) return a;
                  const days =
                    (new Date(d.actualDate).getTime() -
                      new Date(d.pickupDate).getTime()) /
                    (1000 * 60 * 60 * 24);
                  return a + Math.max(0, days);
                }, 0) / delivered.length
              ).toFixed(1),
            )
          : null;
      const totalSpend = ds
        .filter((d) => d.status !== "CANCELLED")
        .reduce((a, d) => a + d.charges, 0);
      const inTransit = ds.filter((d) => d.status === "IN_TRANSIT").length;
      return {
        vendor: {
          id: v.id,
          name: v.name,
          rating: v.rating,
          isApproved: v.isApproved,
          lanes: v.lanes,
          contactPerson: v.contactPerson,
          phone: v.phone,
        },
        dispatches: ds.length,
        delivered: delivered.length,
        onTime: onTime.length,
        onTimePct,
        avgLead,
        totalSpend,
        inTransit,
        active: ds.some(
          (d) => d.status === "IN_TRANSIT" || d.status === "SCHEDULED",
        ),
      };
    });

    const now = new Date();
    const overdue = dispatches.filter(
      (d) =>
        d.status !== "DELIVERED" &&
        d.status !== "CANCELLED" &&
        d.promisedDate < now,
    ).length;
    const dueThisWeek = dispatches.filter((d) => {
      if (d.status !== "SCHEDULED" || d.status !== "SCHEDULED") return false;
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return (
        d.status === "SCHEDULED" &&
        d.promisedDate >= now &&
        d.promisedDate <= end
      );
    }).length;
    const inTransitCount = dispatches.filter(
      (d) => d.status === "IN_TRANSIT",
    ).length;

    return NextResponse.json({
      vendors,
      dispatches,
      scorecards,
      stats: { overdue, dueThisWeek, inTransit: inTransitCount },
    });
  } catch (error) {
    console.error("GET /api/freight error:", error);
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
    const actor = user.name || "Admin";
    const canEdit =
      user.isOwner ||
      canAny(user, [
        "supply.edit",
        "commercial.edit",
        "ops.edit",
        "people.edit",
        "system.edit",
      ]);

    const body = await req.json();
    const { action } = body;

    if (action === "create_dispatch") {
      if (!canEdit)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const {
        vendorId,
        reference,
        route,
        vehicleNumber,
        pickupDate,
        promisedDate,
        charges,
        notes,
      } = body;
      if (!vendorId || !promisedDate) {
        return NextResponse.json(
          { error: "Vendor and promised date are required" },
          { status: 400 },
        );
      }
      const vendor = await prisma.freightVendor.findUnique({
        where: { id: vendorId },
      });
      if (!vendor)
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 },
        );
      const year = new Date().getFullYear();
      const count = await prisma.freightDispatch.count();
      const dispatchNumber = `FD-${year}-${String(count + 1).padStart(3, "0")}`;

      const dispatch = await prisma.freightDispatch.create({
        data: {
          dispatchNumber,
          vendorId,
          reference: reference || null,
          route: route || null,
          vehicleNumber: vehicleNumber || null,
          pickupDate: pickupDate ? new Date(pickupDate) : null,
          promisedDate: new Date(promisedDate),
          charges: parseFloat(charges || "0"),
          notes: notes || null,
        },
        include: { vendor: true },
      });

      await logAudit({
        actor,
        action: "FREIGHT_DISPATCH_SCHEDULED",
        entityType: "FREIGHT_DISPATCH",
        entityId: dispatch.id,
        details: `${dispatchNumber} — ${vendor.name}${route ? ` · ${route}` : ""}, promised ${new Date(promisedDate).toLocaleDateString()}`,
      });
      return NextResponse.json({ success: true, dispatch });
    }

    if (action === "update_status") {
      if (!canEdit)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { dispatchId, status } = body;
      if (!dispatchId || !status) {
        return NextResponse.json(
          { error: "dispatchId and status are required" },
          { status: 400 },
        );
      }
      const allowed = [
        "SCHEDULED",
        "IN_TRANSIT",
        "DELIVERED",
        "DELAYED",
        "CANCELLED",
      ];
      if (!allowed.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const dispatch = await prisma.freightDispatch.findUnique({
        where: { id: dispatchId },
        include: { vendor: true },
      });
      if (!dispatch)
        return NextResponse.json(
          { error: "Dispatch not found" },
          { status: 404 },
        );

      const updated = await prisma.freightDispatch.update({
        where: { id: dispatchId },
        data: {
          status: status as string,
          actualDate:
            status === "DELIVERED"
              ? dispatch.actualDate || new Date()
              : dispatch.actualDate,
        },
        include: { vendor: true },
      });

      await logAudit({
        actor,
        action: `FREIGHT_DISPATCH_${status}`,
        entityType: "FREIGHT_DISPATCH",
        entityId: dispatch.id,
        details: `${dispatch.dispatchNumber} (${dispatch.vendor.name}) → ${status}${status === "DELIVERED" ? " on " + new Date(updated.actualDate || Date.now()).toLocaleDateString() : ""}`,
      });
      return NextResponse.json({ success: true, dispatch: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/freight error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
