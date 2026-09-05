import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDerivedLicenseStatus, updateLicense } from "@/lib/licenseEngine";
import { addDays } from "date-fns";
import { toPaise } from "@/lib/money";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const tokenStr = cookieStore.get("app_session")?.value;
    let actorId = "";

    if (tokenStr) {
      const token = await verifySessionToken(tokenStr);
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!token.isOwner && !token.permissions?.includes("system.edit")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      actorId = token.id;
    } else {
      const headersList = await headers();
      const user = getUserFromHeaders(headersList);
      if (!user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!user.isOwner && !canAny(user, ["system.edit"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      actorId = user.id;
    }

    const { amount, reference } = await req.json();
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const license = await getDerivedLicenseStatus();

    // Extend by 30 days from now, or from nextDueDate if active
    let newDueDate = new Date(license.nextDueDate);
    const now = new Date();
    if (newDueDate < now) {
      newDueDate = now;
    }
    newDueDate = addDays(newDueDate, 30);

    // Update license
    license.nextDueDate = newDueDate.toISOString();
    license.paymentStatus = "ACTIVE";
    await updateLicense(license);

    // Create payment record and audit log atomically
    await prisma.$transaction(async (tx) => {
      const payment = await tx.paymentRecord.create({
        data: {
          amount: toPaise(Number(amount)), // stored integer paise
          method: "OTHER", // Manual payment
          reference: reference || "Manual record",
          extendsUntil: newDueDate,
        },
      });

      await logAuditTx(tx, {
        actor: actorId,
        action: "RECORD_MANUAL_PAYMENT",
        entityType: "BILLING",
        entityId: payment.id,
        details: `Recorded manual payment of ₹${amount} - Ref: ${reference || "Manual record"}`,
      });
    });

    return NextResponse.json({
      success: true,
      nextDueDate: license.nextDueDate,
    });
  } catch (error: any) {
    console.error("Manual Payment Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
