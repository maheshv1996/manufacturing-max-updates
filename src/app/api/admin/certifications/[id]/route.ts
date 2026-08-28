import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const certification = await prisma.certification.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit({
      actor: user.name || "ADMIN",
      action: "CERTIFICATION_DELETED",
      entityType: "Certification",
      entityId: id,
      details: `revoked certification ${id}`,
    });

    return NextResponse.json(certification);
  } catch (error) {
    console.error("Error revoking certification:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
