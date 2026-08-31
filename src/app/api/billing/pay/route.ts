import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getDerivedLicenseStatus } from "@/lib/licenseEngine";

export async function POST() {
    await logAudit({ actor: "system", action: "SUBSCRIPTION_PAYMENT_PROCESSED", entityType: "Subscription", details: "Subscription payment recorded" });
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

    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay keys missing. Please use manual payment." },
        { status: 400 },
      );
    }

    const license = await getDerivedLicenseStatus();
    const amount =
      license.plan === "STARTER"
        ? 4999
        : license.plan === "GROWTH"
          ? 9999
          : 15000;

    // Create Razorpay payment link
    const auth = Buffer.from(
      `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`,
    ).toString("base64");

    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amount * 100, // paise
        currency: "INR",
        accept_partial: false,
        reference_id: `mfgmax_sub_${Date.now()}`,
        description: `Manufacturing Max ${license.plan} Subscription (1 Month)`,
        notes: {
          plan: license.plan,
        },
      }),
    });

    const data = await res.json();
    if (res.ok && data.short_url) {
      return NextResponse.json({ url: data.short_url });
    } else {
      console.error("Razorpay error:", data);
      return NextResponse.json(
        { error: "Failed to create payment link" },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("Payment Link Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
