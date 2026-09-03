import { prisma } from "./prisma";
import { fromPaise } from "./money";
import { getMissedObjectives } from "./qualityObjectives";

export type ComplianceFlag = {
  id: string;
  category: string;
  label: string;
  detail: string;
  severity: "critical" | "warning";
  href: string;
};

function kpiUnit(t?: string | null): string {
  if (!t) return "%";
  const u = String(t).toUpperCase();
  if (u === "PPM") return " ppm";
  if (u === "MTBF" || u === "MTTR" || u === "HOURS") return "h";
  if (u === "CPK" || u === "INDEX") return "";
  if (u === "INR" || u === "CURRENCY") return " ₹";
  return "%";
}

function safeDaysUntil(dateVal: any, baseDate: Date): number | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - baseDate.getTime()) / 86400000);
}

function safeFormatDate(dateVal: any): string {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

/**
 * 360° Comprehensive Factory Compliance Digest Engine.
 * Monitors Environmental EHS, Infrastructure Backups, Tooling & Spares, Contracts, Budgets,
 * 8D CAPA, QMS Document Control, PPAP, AP 3-Way Match, Shift Handovers, and Quality KPIs.
 */
export async function getComplianceFlags(
  now: Date = new Date(),
): Promise<{
  flags: ComplianceFlag[];
  criticalCount: number;
  warningCount: number;
}> {
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  const [
    envRecords,
    backupJobs,
    spareParts,
    activeContracts,
    budgetLines,
    eightDReports,
    ppapSubs,
    supplierInvoices,
    grrStudies,
    qmsDocs,
  ] = await Promise.all([
    (prisma as any).environmentalRecord?.findMany().catch(() => []) ?? [],
    (prisma as any).backupJob?.findMany({ orderBy: { startedAt: "desc" }, take: 10 }).catch(() => []) ?? [],
    (prisma as any).sparePart?.findMany().catch(() => []) ?? [],
    (prisma as any).contract?.findMany({ where: { status: "ACTIVE" } }).catch(() => []) ?? [],
    (prisma as any).budgetLine?.findMany().catch(() => []) ?? [],
    (prisma as any).eightDReport?.findMany({ orderBy: { raisedAt: "desc" } }).catch(() => []) ?? [],
    (prisma as any).ppapSubmission?.findMany().catch(() => []) ?? [],
    (prisma as any).supplierInvoice?.findMany().catch(() => []) ?? [],
    (prisma as any).gageRnrStudy?.findMany().catch(() => []) ?? [],
    (prisma as any).qmsDocument?.findMany().catch(() => []) ?? [],
  ]);

  const flags: ComplianceFlag[] = [];

  // 1. Environmental & Safety Permits
  envRecords.forEach((r: any) => {
    if (!r) return;
    const dueIn = safeDaysUntil(r.dueDate, safeNow);
    const nonCompliant = String(r.complianceStatus || "").toUpperCase() !== "COMPLIANT";
    const overdue = dueIn !== null && dueIn <= 0;

    if (nonCompliant || (dueIn !== null && dueIn <= 30)) {
      flags.push({
        id: `env-${r.id}`,
        category: "Environment",
        label: nonCompliant
          ? `${r.title || "Permit"} · ${r.complianceStatus || "Non-Compliant"}`
          : `${r.title || "Permit"} · due ${overdue ? "OVERDUE" : `in ${dueIn}d`}`,
        detail: r.permitNumber || r.owner || "EHS Regulatory",
        severity: nonCompliant || overdue ? "critical" : "warning",
        href: "/system/ehs",
      });
    }
  });

  // 2. Disaster Recovery & Backup Failures
  backupJobs
    .filter((b: any) => String(b?.status || "").toUpperCase() === "FAILED")
    .forEach((b: any) => {
      const startedStr = safeFormatDate(b.startedAt);
      flags.push({
        id: `bk-${b.id}`,
        category: "Backups",
        label: "Database backup job failed",
        detail: startedStr ? `Started ${startedStr}` : b.target || "Automated Snapshot",
        severity: "critical",
        href: "/system/infrastructure",
      });
    });

  // 3. Maintenance Spares Below Reorder Point
  spareParts
    .filter((s: any) => {
      if (!s) return false;
      const cur = Number(s.currentQty) || 0;
      const reorder = Number(s.reorderPoint) > 0 ? Number(s.reorderPoint) : Number(s.minQty) || 0;
      return cur <= reorder;
    })
    .forEach((s: any) => {
      const rp = Number(s.reorderPoint) > 0 ? Number(s.reorderPoint) : Number(s.minQty) || 0;
      const abc = String(s.abcClass || "").toUpperCase();
      const ved = String(s.vedClass || "").toUpperCase();
      flags.push({
        id: `sp-${s.id}`,
        category: "Spares",
        label: `Below reorder threshold · ${s.name || "Spare Part"}`,
        detail: `${s.currentQty || 0} on hand / min ${rp}${abc ? ` · ABC ${abc}` : ""}${ved ? ` · VED ${ved}` : ""}`,
        severity: abc === "A" || ved === "V" ? "critical" : "warning",
        href: "/maintenance/spares-abc",
      });
    });

  // 4. Commercial & Plant Contracts Expiring
  activeContracts.forEach((c: any) => {
    if (!c?.endDate) return;
    const daysLeft = safeDaysUntil(c.endDate, safeNow);
    if (daysLeft !== null && daysLeft <= 90) {
      const endStr = safeFormatDate(c.endDate);
      flags.push({
        id: `ct-${c.id}`,
        category: "Contracts",
        label: `Contract renewal due · ${c.title || c.contractNumber || "Vendor Contract"}`,
        detail: `Expires ${endStr} (${daysLeft <= 0 ? "OVERDUE" : `${daysLeft}d remaining`})`,
        severity: daysLeft <= 30 ? "critical" : "warning",
        href: "/projects/contracts",
      });
    }
  });

  // 5. Departmental Treasury & Budget Overruns
  budgetLines.forEach((b: any) => {
    if (!b) return;
    const allocated = Number(b.allocated) || 0;
    const spent = Number(b.spent) || 0;
    if (allocated <= 0) return;
    const pct = (spent / allocated) * 100;

    if (spent > allocated) {
      flags.push({
        id: `budget-${b.id}`,
        category: "Budget",
        label: `Budget overrun · ${b.department || "Dept"} / ${b.category || "General"}`,
        detail: `₹${spent.toLocaleString("en-IN")} spent vs ₹${allocated.toLocaleString("en-IN")} allocated (${pct.toFixed(0)}%)`,
        severity: "critical",
        href: "/commercial/treasury",
      });
    } else if (pct >= 80) {
      flags.push({
        id: `budget-${b.id}`,
        category: "Budget",
        label: `Budget limit approaching (${pct.toFixed(0)}%) · ${b.department || "Dept"}`,
        detail: `₹${spent.toLocaleString("en-IN")} of ₹${allocated.toLocaleString("en-IN")} consumed`,
        severity: "warning",
        href: "/commercial/treasury",
      });
    }
  });

  // 6. Quality 8D & CAPA Escalations
  eightDReports
    .filter((r: any) => {
      if (!r) return false;
      const status = String(r.status || "").toUpperCase();
      const sev = String(r.severity || "").toUpperCase();
      return status !== "CLOSED" && (sev === "HIGH" || sev === "CRITICAL");
    })
    .forEach((r: any) => {
      const isCrit = String(r.severity || "").toUpperCase() === "CRITICAL";
      flags.push({
        id: `8d-${r.id}`,
        category: "8D / CAPA",
        label: `Open 8D CAPA · ${r.reportNumber || "Report"} · ${r.severity}`,
        detail: r.title || "Corrective action required",
        severity: isCrit ? "critical" : "warning",
        href: "/quality/8d",
      });
    });

  // 7. QMS Document Annual Reviews
  qmsDocs
    .filter((d: any) => d && String(d.status || "").toUpperCase() !== "OBSOLETE" && d.nextReviewAt)
    .forEach((d: any) => {
      const dueIn = safeDaysUntil(d.nextReviewAt, safeNow);
      if (dueIn !== null && dueIn <= 30) {
        flags.push({
          id: `qms-doc-${d.id}`,
          category: "QMS Documents",
          label: `${d.docNumber || "SOP"} · ${d.title || "Procedure"} · review ${dueIn <= 0 ? "OVERDUE" : `in ${dueIn}d`}`,
          detail: `Rev ${d.revision || "A"} · Owner ${d.owner || "QA"}`,
          severity: dueIn <= 0 ? "critical" : "warning",
          href: "/quality/qms-docs",
        });
      }
    });

  // 8. PPAP Submissions
  ppapSubs
    .filter((p: any) => {
      if (!p) return false;
      const s = String(p.status || "").toUpperCase();
      return s === "SUBMITTED" || s === "REJECTED";
    })
    .forEach((p: any) => {
      const isRej = String(p.status || "").toUpperCase() === "REJECTED";
      flags.push({
        id: `ppap-${p.id}`,
        category: "PPAP",
        label: `PPAP ${isRej ? "REJECTED" : "Awaiting Approval"} · ${p.ppapNumber || "Package"}`,
        detail: p.customerName || "Customer Quality Engineering",
        severity: isRej ? "critical" : "warning",
        href: "/quality/ppap",
      });
    });

  // 9. AP 3-Way Match Invoices
  supplierInvoices
    .filter((i: any) => i && String(i.status || "").toUpperCase() === "MISMATCHED")
    .forEach((i: any) => {
      flags.push({
        id: `inv-${i.id}`,
        category: "AP 3-Way Match",
        label: `Invoice mismatch · ${i.invoiceNumber || "Invoice"}`,
        detail: `PO ⇄ GRN ⇄ Invoice price/qty variance (₹${fromPaise(Number(i.totalAmount) || 0).toLocaleString("en-IN")})`,
        severity: "critical",
        href: "/supply/grn",
      });
    });

  // 10. Unacknowledged Shift Handovers (>8 hours unacknowledged)
  try {
    const eightHoursAgo = new Date(safeNow.getTime() - 8 * 3600 * 1000);
    const unacked = await (prisma as any).shiftHandover?.findFirst({
      where: {
        acknowledgedAt: null,
        createdAt: { lte: eightHoursAgo },
      },
      orderBy: { createdAt: "desc" },
      include: { shift: true },
    });

    if (unacked) {
      flags.push({
        id: `handover-${unacked.id}`,
        category: "Shift Handover",
        label: `Shift handover pending signoff · ${unacked.shift?.name || "Shift"}`,
        detail: `Logged by ${unacked.authorName || "Supervisor"} — requires incoming supervisor signoff.`,
        severity: "warning",
        href: "/people/handover",
      });
    }
  } catch {
    // Handover check must never throw
  }

  // 11. Quality KPI Target Misses
  try {
    const missed = await getMissedObjectives(safeNow);
    (missed || []).forEach((m) => {
      if (!m?.objective) return;
      const meta = m.objective.kpiType;
      flags.push({
        id: `obj-${m.objective.id}`,
        category: "Quality Objective",
        label: `Target missed · ${m.objective.department || "Quality"} / ${meta || "KPI"}`,
        detail: `Actual ${m.actual}${kpiUnit(meta)} vs target ${m.objective.targetValue}${kpiUnit(meta)} (${m.detail || "Under review"})`,
        severity: "warning",
        href: "/quality/objectives",
      });
    });
  } catch {
    // Objectives check must never throw
  }

  // 12. CLRA Contractor Licenses
  try {
    const contractors = await (prisma as any).contractor?.findMany().catch(() => []) ?? [];
    contractors.forEach((c: any) => {
      if (!c?.licenseValidUntil) return;
      const dueIn = safeDaysUntil(c.licenseValidUntil, safeNow);
      if (dueIn !== null && dueIn <= 90) {
        flags.push({
          id: `clra-${c.id}`,
          category: "CLRA Licences",
          label: `${c.name || "Contractor"} · ${c.licenseNumber || "CLRA"} · ${dueIn <= 0 ? "LICENCE EXPIRED" : `due in ${dueIn}d`}`,
          detail: c.gstin ? `GSTIN ${c.gstin}` : "Contract labor compliance",
          severity: dueIn <= 0 ? "critical" : "warning",
          href: "/people/clra",
        });
      }
    });
  } catch {
    // CLRA check must never throw
  }

  // 13. State Pollution Control Board Consents
  try {
    const consents = await (prisma as any).consent?.findMany().catch(() => []) ?? [];
    consents.forEach((c: any) => {
      if (!c?.validUntil) return;
      const dueIn = safeDaysUntil(c.validUntil, safeNow);
      if (dueIn !== null && dueIn <= 90) {
        const validUntilStr = safeFormatDate(c.validUntil);
        flags.push({
          id: `consent-${c.id}`,
          category: "Consent Renewals",
          label: `${c.type || "SPCB"} Consent · ${c.boardRef || "PCB"} · ${dueIn <= 0 ? "EXPIRED" : `due in ${dueIn}d`}`,
          detail: `${c.consentNumber || ""} · Valid until ${validUntilStr}`,
          severity: dueIn <= 0 ? "critical" : "warning",
          href: "/ehs/consents",
        });
      }
    });
  } catch {
    // Consent check must never throw
  }

  // 14. Customer Quality Scorecards (PPM & OTD)
  try {
    const scorecards = await (prisma as any).customerScorecard?.findMany({
      orderBy: { receivedAt: "desc" },
      take: 50,
    }).catch(() => []) ?? [];

    scorecards.forEach((s: any) => {
      if (!s) return;
      const ppm = s.ppm !== null && s.ppm !== undefined ? Number(s.ppm) : null;
      const otp = s.otpPct !== null && s.otpPct !== undefined ? Number(s.otpPct) : null;
      const critical = (ppm !== null && ppm >= 5000) || (otp !== null && otp < 70);
      const isWarning = (ppm !== null && ppm >= 1000) || (otp !== null && otp < 90);

      if (isWarning || critical) {
        flags.push({
          id: `scc-${s.id}`,
          category: "Customer Scorecards",
          label: `Scorecard rating degraded · ${s.customerName || "Customer"} (${s.period || "Monthly"})`,
          detail: [
            ppm !== null ? `PPM ${ppm}` : "",
            otp !== null ? `OTD ${otp}%` : "",
          ].filter(Boolean).join(" · "),
          severity: critical ? "critical" : "warning",
          href: "/commercial/scorecards",
        });
      }
    });
  } catch {
    // Scorecard check must never throw
  }

  // 15. IT Infrastructure & Ticket SLAs
  try {
    const tickets = await (prisma as any).itTicket?.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        slaDueAt: true,
      },
    }).catch(() => []) ?? [];

    tickets.forEach((t: any) => {
      if (!t?.slaDueAt) return;
      const d = new Date(t.slaDueAt);
      if (isNaN(d.getTime())) return;
      const pri = String(t.priority || "").toUpperCase();
      if (d.getTime() < safeNow.getTime() && (pri === "HIGH" || pri === "CRITICAL")) {
        flags.push({
          id: `itt-${t.id}`,
          category: "IT Tickets",
          label: `SLA BREACHED · ${t.ticketNumber || "Ticket"} · ${t.priority}`,
          detail: t.title || "IT Support escalation",
          severity: pri === "CRITICAL" ? "critical" : "warning",
          href: "/system/tickets",
        });
      }
    });
  } catch {
    // Ticket check must never throw
  }

  // 16. Gage R&R Studies
  grrStudies
    .filter((s: any) => String(s?.verdict || "").toUpperCase() === "UNACCEPTABLE")
    .forEach((s: any) => {
      flags.push({
        id: `grr-${s.id}`,
        category: "Gage R&R",
        label: `Measurement system unacceptable · ${s.studyNumber || "MSA"}`,
        detail: `%GRR ${s.grrPct || 0}% — Gage does not satisfy AIAG acceptance criteria`,
        severity: "warning",
        href: "/quality/grr",
      });
    });

  // Sort critical items to the top
  flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));

  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const warningCount = flags.length - criticalCount;

  return {
    flags,
    criticalCount,
    warningCount,
  };
}
