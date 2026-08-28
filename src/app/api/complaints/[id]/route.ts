import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { ComplaintStatus, ComplaintDisposition } from "@prisma/client";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    if (!can(user, "ops.view") && !can(user, "commercial.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const complaint = await prisma.customerComplaint.findUnique({
      where: { id },
      include: {
        workOrder: {
          include: {
            productionLogs: true,
            qualityInspections: true,
            inventoryTransactions: {
              where: { type: "CONSUMPTION" },
              include: {
                rawMaterial: true,
              },
            },
            dispatchRecords: true,
          },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(complaint);
  } catch (error) {
    console.error("Failed to fetch complaint details:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    if (!can(user, "ops.edit") && !can(user, "commercial.edit")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { status, rootCause, capaAction, disposition } = body;

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status as ComplaintStatus;
    if (rootCause !== undefined) dataToUpdate.rootCause = rootCause;
    if (capaAction !== undefined) dataToUpdate.capaAction = capaAction;
    if (disposition !== undefined)
      dataToUpdate.disposition = disposition as ComplaintDisposition;

    // M8 — SLA tracking: acknowledging stamps ackAt; closing stamps the 8D closure time
    if (status === "ACKNOWLEDGED") {
      dataToUpdate.ackAt = new Date();
    }
    if (status === "CLOSED") {
      dataToUpdate.closedAt = new Date();
      dataToUpdate.eightDClosedAt = new Date();
    }

    const complaint = await prisma.customerComplaint.update({
      where: { id },
      data: dataToUpdate,
    });

    if (status === "CLOSED") {
      await prisma.auditLog.create({
        data: {
          action: "COMPLAINT_CLOSED",
          entityType: "CustomerComplaint",
          entityId: complaint.id,
          details: JSON.stringify({
            complaintNumber: complaint.complaintNumber,
            disposition,
          }),
          actor: user.name,
        },
      });
    }

    return NextResponse.json(complaint);
  } catch (error) {
    console.error("Failed to update complaint:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
