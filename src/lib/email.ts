import { prisma } from "./prisma";
import type { ComplianceFlag } from "./complianceDigest";

export type EmailResult = {
  sent: boolean;
  reason?: string;
};

// Sends email through the Resend REST API when RESEND_API_KEY is configured.
// No npm dependency — plain fetch. Add SMTP (nodemailer) here later if needed.
export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    "Manufacturing Max <noreply@manufacturingmax.app>";
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }
  const recipients = opts.to.filter(Boolean);
  if (!recipients.length) {
    return { sent: false, reason: "No recipients" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        sent: false,
        reason: `Resend ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { sent: true };
  } catch (error: any) {
    return { sent: false, reason: error?.message || "Network error" };
  }
}

export async function getOwnerEmails(): Promise<string[]> {
  const owners = await prisma.user.findMany({
    where: { isOwner: true },
    select: { email: true },
  });
  return owners.map((o) => o.email).filter(Boolean) as string[];
}

const flagRow = (f: ComplianceFlag) =>
  `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#${f.severity === "critical" ? "b91c1c" : "b45309"};font-weight:700;font-size:13px">${f.severity.toUpperCase()}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#111">${f.label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">${f.detail || ""}</td></tr>`;

export function buildDigestEmailHtml(p: {
  generatedAt: Date;
  criticalCount: number;
  warningCount: number;
  flags: ComplianceFlag[];
  calibrationTools: { expired: number; expiring: number };
  expiredVendors: number;
  quality: {
    openNcrCount: number;
    pendingEcoCount: number;
    lowStockCount: number;
  };
}): string {
  const rows = p.flags.length
    ? p.flags.map(flagRow).join("")
    : '<tr><td colspan="3" style="padding:16px;text-align:center;color:#888;font-size:13px">✅ No compliance flags today — everything is green.</td></tr>';
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:18px">Daily Compliance Digest</h2>
      <div style="color:#94a3b8;font-size:12px;margin-top:4px">${p.generatedAt.toLocaleString()}</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center;color:#b91c1c;font-size:13px;font-weight:700">CRITICAL<br/><span style="font-size:26px">${p.criticalCount}</span></td>
          <td style="width:8px"></td>
          <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;color:#b45309;font-size:13px;font-weight:700">WARNING<br/><span style="font-size:26px">${p.warningCount}</span></td>
          <td style="width:8px"></td>
          <td style="background:#e0e7ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px;text-align:center;color:#4338ca;font-size:13px;font-weight:700">QUALITY<br/><span style="font-size:26px">${p.quality.openNcrCount}</span></td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Severity</th><th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Flag</th><th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Detail</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:20px;font-size:12px;color:#475569;border-top:1px solid #e2e8f0;padding-top:12px">
        Metrology: <b>${p.calibrationTools.expired}</b> expired tools · <b>${p.calibrationTools.expiring}</b> expiring · <b>${p.expiredVendors}</b> expired vendor certs<br/>
        Quality: <b>${p.quality.openNcrCount}</b> open NCRs · <b>${p.quality.pendingEcoCount}</b> draft ECOs · <b>${p.quality.lowStockCount}</b> materials below min<br/>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://manufacturingmax.app"}/reports/compliance-digest" style="color:#2563eb">Open the printable digest →</a>
      </div>
    </div>
  </div>`;
}

export function buildChallanEmailHtml(p: {
  employer: string;
  month: string;
  challanNo: string;
  pfTotal: number;
  esiTotal: number;
  grandTotal: number;
  employeeCount: number;
}): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#7c2d12;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:18px">PF / ESI Payment Challan — ${p.month}</h2>
      <div style="color:#fdba74;font-size:12px;margin-top:4px">${p.employer} · ${p.challanNo}</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Contribution period</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:13px">${p.month}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Employees covered</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:13px">${p.employeeCount}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:13px">PF payable</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:13px">₹ ${p.pfTotal.toLocaleString("en-IN")}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:13px">ESI payable</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:13px">₹ ${p.esiTotal.toLocaleString("en-IN")}</td></tr>
        <tr style="border-top:2px solid #e2e8f0"><td style="padding:10px 0;font-weight:800;font-size:14px">Grand total</td><td style="padding:10px 0;text-align:right;font-weight:800;font-size:16px">₹ ${p.grandTotal.toLocaleString("en-IN")}</td></tr>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://manufacturingmax.app"}/reports/pf-esi-challan?month=${p.month}" style="display:inline-block;margin-top:20px;background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;font-size:13px">Open printable challan →</a>
    </div>
  </div>`;
}
