import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDerivedLicenseStatus, updateLicense } from "@/lib/licenseEngine";
import { addDays } from "date-fns";
import crypto from "crypto";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return NextResponse.json(
        { error: "Missing signature or secret" },
        { status: 400 },
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    if (payload.event === "payment_link.paid") {
      const paymentLink = payload.payload.payment_link.entity;

      const license = await getDerivedLicenseStatus();

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
      const paymentRecord = await prisma.paymentRecord.create({
        data: {
          amount: paymentLink.amount / 100, // convert paise to INR
          method: "RAZORPAY",
          reference: paymentLink.reference_id,
          extendsUntil: newDueDate,
        },
      });

      await logAudit({
        actor: "system",
        action: "WEBHOOK_RECEIVED",
        entityType: "PaymentRecord",
        entityId: paymentRecord.id,
        details: `payment_link.paid · ${paymentLink.reference_id} · ${paymentLink.amount / 100} INR`,
      });

      return NextResponse.json({ status: "ok" });
    }
  } catch (error: any) {
    console.error("Razorpay Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
