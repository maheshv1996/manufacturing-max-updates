import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isOwner && !can(user, "system.edit") && !can(user, "quality.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const certification = await prisma.$transaction(async (tx) => {
      const res = await tx.certification.update({
        where: { id },
        data: { isActive: false },
      });

      await logAuditTx(tx, {
        actor: user.name || "ADMIN",
        action: "CERTIFICATION_DELETED",
        entityType: "Certification",
        entityId: id,
        details: `revoked certification ${id}`,
        severity: "WARN",
      });

      return res;
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
