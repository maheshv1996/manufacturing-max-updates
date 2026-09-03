import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDerivedLicenseStatus, updateLicense } from "@/lib/licenseEngine";
import { addDays } from "date-fns";
import { toPaise } from "@/lib/money";

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "MANUAL_INVOICE_GENERATED", entityType: "BillingInvoice", details: "Manual billing invoice created" });
  try {
    const cookieStore = await cookies();
    const tokenStr = cookieStore.get("app_session")?.value;
    if (!tokenStr)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = await verifySessionToken(tokenStr);
    if (
      !token ||
      (!token.isOwner && !token.permissions?.includes("system.edit"))
    )
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // Create payment record
    await prisma.paymentRecord.create({
      data: {
        amount: toPaise(Number(amount)), // stored integer paise
        method: "OTHER", // Manual payment
        reference: reference || "Manual record",
        extendsUntil: newDueDate,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actor: token.id,
        action: "RECORD_MANUAL_PAYMENT",
        entityType: "BILLING",
        details: `Recorded manual payment of ₹${amount} - Ref: ${reference}`,
      },
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
