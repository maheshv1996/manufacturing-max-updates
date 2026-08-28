import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getComplianceFlags } from "@/lib/complianceDigest";
import {
  computeCalibrationStatus,
  computeVendorStatus,
} from "@/lib/calibration";
import { sendEmail, buildDigestEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily compliance digest dispatch.
// - Called by the in-app "Dispatch to Owner" button (authenticated user).
// - Called by Vercel Cron (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
// - Sends real email via Resend when RESEND_API_KEY is set; otherwise records
//   the dispatch in ComplianceDigestLog + AuditLog so nothing is lost.
export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const cronAuthed =
    process.env.CRON_SECRET &&
    req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

  if (
    !cronAuthed &&
    !user.isOwner &&
    !canAny(user, ["system.edit", "ops.edit"])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const { flags, criticalCount, warningCount } =
      await getComplianceFlags(now);

    const [owners, calibratedToolsDb, specialProcessVendorsDb] =
      await Promise.all([
        prisma.user.findMany({
          where: { isOwner: true },
          select: { name: true, email: true },
        }),
        prisma.calibratedTool.findMany(),
        prisma.specialProcessVendor.findMany(),
      ]);
    const recipientEmails = owners
      .map((o) => o.email)
      .filter(Boolean) as string[];

    const [openNcrCount, pendingEcoCount, lowStockCount] = await Promise.all([
      (prisma as any).ncrReport.count({ where: { status: "OPEN" } }),
      prisma.eco.count({ where: { status: "DRAFT" } }),
      (prisma as any).rawMaterial
        .findMany({ where: { isActive: true } })
        .then(
          (mats: any[]) =>
            mats.filter((m) => m.currentStock <= m.minStock).length,
        ),
    ]);

    const email = await sendEmail({
      to: recipientEmails,
      subject: `Daily Compliance Digest — ${criticalCount} critical, ${warningCount} warning (${now.toLocaleDateString()})`,
      html: buildDigestEmailHtml({
        generatedAt: now,
        criticalCount,
        warningCount,
        flags,
        calibrationTools: {
          expired: calibratedToolsDb.filter(
            (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRED",
          ).length,
          expiring: calibratedToolsDb.filter(
            (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRING_SOON",
          ).length,
        },
        expiredVendors: specialProcessVendorsDb.filter(
          (v) => computeVendorStatus(v.expiresAt) === "EXPIRED",
        ).length,
        quality: { openNcrCount, pendingEcoCount, lowStockCount },
      }),
    });

    const status = email.sent ? "EMAILED" : "LOGGED";

    const log = await prisma.complianceDigestLog.create({
      data: {
        recipientEmails: JSON.stringify(recipientEmails),
        criticalCount,
        warningCount,
        payload: JSON.stringify({ flags, generatedAt: now.toISOString() }),
        status,
      },
    });

    await logAudit({
      actor: cronAuthed ? "System (cron)" : user.name || "System",
      action: "DISPATCH_COMPLIANCE_DIGEST",
      entityType: "COMPLIANCE_DIGEST",
      entityId: log.id,
      details: `Compliance digest dispatched to ${recipientEmails.length} owner recipient(s) — ${criticalCount} critical, ${warningCount} warning (${status})`,
    });

    return NextResponse.json({
      success: true,
      logId: log.id,
      status,
      recipients: recipientEmails,
      counts: { criticalCount, warningCount },
      generatedAt: now.toISOString(),
      message: email.sent
        ? `Digest emailed to ${recipientEmails.length} owner recipient(s).`
        : `Digest recorded for ${recipientEmails.length} owner recipient(s) but not emailed: ${email.reason || "no gateway"}. Set RESEND_API_KEY to enable real email.`,
    });
  } catch (error) {
    console.error("POST /api/compliance/digest/send error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
