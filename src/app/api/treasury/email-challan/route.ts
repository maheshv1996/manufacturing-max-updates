import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getBranding } from "@/lib/settings";
import { sendEmail, getOwnerEmails, buildChallanEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["commercial.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const month = String(body?.month || "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Month must be YYYY-MM" },
        { status: 400 },
      );
    }

    const rows = await prisma.statutoryContribution.findMany({
      where: { month },
    });
    if (!rows.length) {
      return NextResponse.json(
        { error: `No statutory contributions for ${month}` },
        { status: 400 },
      );
    }

    const pfTotal = rows.reduce((s, r) => s + r.pfEmployee + r.pfEmployer, 0);
    const esiTotal = rows.reduce(
      (s, r) => s + r.esiEmployee + r.esiEmployer,
      0,
    );
    const grandTotal = pfTotal + esiTotal;
    const challanNo = `CH-${month.replace("-", "")}-001`;
    const branding = await getBranding();

    const recipients = await getOwnerEmails();
    const email = await sendEmail({
      to: recipients,
      subject: `PF / ESI Challan ${month} — ₹${grandTotal.toLocaleString("en-IN")}`,
      html: buildChallanEmailHtml({
        employer: branding.companyName || "Manufacturing Max",
        month,
        challanNo,
        pfTotal,
        esiTotal,
        grandTotal,
        employeeCount: rows.length,
      }),
    });

    await logAudit({
      actor: user.name || "Admin",
      action: "EMAIL_CHALLAN",
      entityType: "CHALLAN",
      entityId: challanNo,
      details: `Challan ${challanNo} (${month}) emailed to ${recipients.length} owner recipient(s) — ${email.sent ? "sent" : email.reason || "not sent"}`,
    });

    return NextResponse.json({
      success: true,
      emailed: email.sent,
      recipients,
      challanNo,
      grandTotal,
      message: email.sent
        ? `Challan emailed to ${recipients.length} owner recipient(s).`
        : `Challan ready but not emailed: ${email.reason || "no gateway"}. Set RESEND_API_KEY to enable real email.`,
    });
  } catch (error) {
    console.error("POST /api/treasury/email-challan error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
