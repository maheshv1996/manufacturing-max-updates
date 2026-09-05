import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { getDerivedLicenseStatus } from "@/lib/licenseEngine";

export async function POST() {
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
      await logAudit({
        actor: actorId,
        action: "SUBSCRIPTION_PAYMENT_LINK_CREATED",
        entityType: "Subscription",
        details: `Created Razorpay link for ${license.plan} (₹${amount})`,
      });
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
