import { prisma } from "./prisma";
import { getMissedObjectives } from "./qualityObjectives";

export type ComplianceFlag = {
  id: string;
  category: string;
  label: string;
  detail: string;
  severity: "critical" | "warning";
  href: string;
};

export async function getComplianceFlags(
  now: Date = new Date(),
): Promise<{
  flags: ComplianceFlag[];
  criticalCount: number;
  warningCount: number;
}> {
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
    (prisma as any).environmentalRecord.findMany(),
    (prisma as any).backupJob.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    (prisma as any).sparePart.findMany(),
    (prisma as any).contract.findMany({ where: { status: "ACTIVE" } }),
    (prisma as any).budgetLine.findMany(),
    (prisma as any).eightDReport.findMany({ orderBy: { raisedAt: "desc" } }),
    (prisma as any).ppapSubmission.findMany(),
    (prisma as any).supplierInvoice.findMany(),
    (prisma as any).gageRnrStudy.findMany(),
    (prisma as any).qmsDocument.findMany(),
  ]);

  const flags: ComplianceFlag[] = [];

  envRecords.forEach((r: any) => {
    const dueIn = r.dueDate
      ? Math.ceil((new Date(r.dueDate).getTime() - now.getTime()) / 86400000)
      : null;
    const nonCompliant = r.complianceStatus !== "COMPLIANT";
    const overdue = dueIn !== null && dueIn <= 0;
    if (nonCompliant || (dueIn !== null && dueIn <= 30)) {
      flags.push({
        id: `env-${r.id}`,
        category: "Environment",
        label: nonCompliant
          ? `${r.title} · ${r.complianceStatus}`
          : `${r.title} · due ${overdue ? "overdue" : `in ${dueIn}d`}`,
        detail: r.permitNumber || r.owner || "",
        severity: nonCompliant || overdue ? "critical" : "warning",
        href: "/system/ehs",
      });
    }
  });

  backupJobs
    .filter((b: any) => b.status === "FAILED")
    .forEach((b: any) => {
      flags.push({
        id: `bk-${b.id}`,
        category: "Backups",
        label: "Backup job failed",
        detail: b.startedAt
          ? `Started ${new Date(b.startedAt).toLocaleDateString()}`
          : b.target || "",
        severity: "critical",
        href: "/system/infrastructure",
      });
    });

  spareParts
    .filter(
      (s: any) =>
        s.currentQty <=
        (Number(s.reorderPoint) > 0
          ? Number(s.reorderPoint)
          : Number(s.minQty)),
    )
    .forEach((s: any) => {
      const rp =
        Number(s.reorderPoint) > 0 ? Number(s.reorderPoint) : Number(s.minQty);
      flags.push({
        id: `sp-${s.id}`,
        category: "Spares",
        label: `At / below reorder · ${s.name}`,
        detail: `${s.currentQty} on hand / reorder ${rp}${s.abcClass ? ` · ABC ${s.abcClass}${s.vedClass ? ` / VED ${s.vedClass}` : ""}` : ""}`,
        severity:
          s.abcClass === "A" || s.vedClass === "V" ? "critical" : "warning",
        href: "/maintenance/spares-abc",
      });
    });

  activeContracts.forEach((c: any) => {
    if (!c.endDate) return;
    const daysLeft = Math.ceil(
      (new Date(c.endDate).getTime() - now.getTime()) / 86400000,
    );
    if (daysLeft <= 90) {
      flags.push({
        id: `ct-${c.id}`,
        category: "Contracts",
        label: `Contract expiring · ${c.title || c.contractNumber}`,
        detail: `Ends ${new Date(c.endDate).toLocaleDateString()} (${daysLeft <= 0 ? "overdue" : `${daysLeft}d left`})`,
        severity: daysLeft <= 30 ? "critical" : "warning",
        href: "/projects/contracts",
      });
    }
  });

  budgetLines.forEach((b: any) => {
    const allocated = Number(b.allocated) || 0;
    const spent = Number(b.spent) || 0;
    if (allocated <= 0) return;
    const pct = (spent / allocated) * 100;
    if (spent > allocated) {
      flags.push({
        id: `budget-${b.id}`,
        category: "Budget",
        label: `Budget overrun · ${b.department} / ${b.category}`,
        detail: `₹${spent.toLocaleString("en-IN")} spent vs ₹${allocated.toLocaleString("en-IN")} allocated (${pct.toFixed(0)}%)`,
        severity: "critical",
        href: "/commercial/treasury",
      });
    } else if (pct >= 80) {
      flags.push({
        id: `budget-${b.id}`,
        category: "Budget",
        label: `Budget at ${pct.toFixed(0)}% · ${b.department} / ${b.category}`,
        detail: `₹${spent.toLocaleString("en-IN")} of ₹${allocated.toLocaleString("en-IN")} spent — approaching limit`,
        severity: "warning",
        href: "/commercial/treasury",
      });
    }
  });

  // 8D / CAPA — open reports at HIGH or CRITICAL severity demand attention
  eightDReports
    .filter(
      (r: any) =>
        r.status !== "CLOSED" && ["HIGH", "CRITICAL"].includes(r.severity),
    )
    .forEach((r: any) => {
      flags.push({
        id: `8d-${r.id}`,
        category: "8D / CAPA",
        label: `Open 8D · ${r.reportNumber} · ${r.severity}`,
        detail: r.title,
        severity: r.severity === "CRITICAL" ? "critical" : "warning",
        href: "/quality/8d",
      });
    });

  // M9 — QMS document control: annual reviews due or overdue hit the digest
  qmsDocs
    .filter((d: any) => d.status !== "OBSOLETE")
    .forEach((d: any) => {
      const dueIn = Math.ceil(
        (new Date(d.nextReviewAt).getTime() - now.getTime()) / 86400000,
      );
      if (dueIn <= 30) {
        flags.push({
          id: `qms-doc-${d.id}`,
          category: "QMS Documents",
          label: `${d.docNumber} · ${d.title} · review ${dueIn <= 0 ? "OVERDUE" : `due in ${dueIn}d`}`,
          detail: `rev ${d.revision} · owner ${d.owner}`,
          severity: dueIn <= 0 ? "critical" : "warning",
          href: "/quality/qms-docs",
        });
      }
    });

  // PPAP — submissions awaiting approval or rejected need disposition
  ppapSubs
    .filter((p: any) => p.status === "SUBMITTED" || p.status === "REJECTED")
    .forEach((p: any) => {
      flags.push({
        id: `ppap-${p.id}`,
        category: "PPAP",
        label: `PPAP ${p.status === "REJECTED" ? "rejected" : "awaiting approval"} · ${p.ppapNumber}`,
        detail: p.customerName || "No customer on record",
        severity: p.status === "REJECTED" ? "critical" : "warning",
        href: "/quality/ppap",
      });
    });

  // Supplier invoices — 3-way match failures block payment
  supplierInvoices
    .filter((i: any) => i.status === "MISMATCHED")
    .forEach((i: any) => {
      flags.push({
        id: `inv-${i.id}`,
        category: "AP 3-Way Match",
        label: `Invoice mismatch · ${i.invoiceNumber}`,
        detail: `PO ⇄ GRN ⇄ Invoice disagree — payment blocked (₹${(i.totalAmount || 0).toLocaleString("en-IN")})`,
        severity: "critical",
        href: "/supply/grn",
      });
    });

  // P6 — unacknowledged shift handovers: the incoming supervisor must acknowledge
  // the previous shift's logbook before the morning review trusts the numbers.
  try {
    const unacked = await prisma.shiftHandover.findFirst({
      where: {
        acknowledgedAt: null,
        date: {
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
      orderBy: { date: "desc" },
      include: { shift: true },
    });
    if (unacked) {
      flags.push({
        id: `handover-${unacked.id}`,
        category: "Shift Handover",
        label: `Shift handover unacknowledged · ${unacked.shift?.name || "shift"} (${new Date(unacked.date).toLocaleDateString()})`,
        detail: `Written by ${unacked.authorName} — incoming supervisor must acknowledge before morning review.`,
        severity: "warning",
        href: "/people/handover",
      });
    }
  } catch {
    // handover flag must never break the digest
  }

  // Quality objectives — missed KPI targets surface as digest flags (feeds MRM agenda).
  try {
    const missed = await getMissedObjectives(now);
    missed.forEach((m) => {
      const meta = m.objective.kpiType;
      flags.push({
        id: `obj-${m.objective.id}`,
        category: "Quality Objective",
        label: `Objective missed · ${m.objective.department} / ${meta}`,
        detail: `Actual ${m.actual}${kpiUnit(meta)} vs target ${m.objective.targetValue}${kpiUnit(meta)} (${m.detail})`,
        severity: "warning",
        href: "/quality/objectives",
      });
    });
  } catch (e) {
    // digest must never fail because objectives couldn't compute
  }

  // P27 — EHS observation quota: every manager with ehs.view must log their
  // monthly safety observations; a manager below quota is a digest flag.
  try {
    const [users, incidents, quotaSetting] = await Promise.all([
      (prisma as any).user.findMany({
        where: { isActive: true },
        include: { role: { select: { permissions: true } } },
      }),
      (prisma as any).safetyIncident.findMany({
        where: {
          type: { in: ["NEAR_MISS", "HAZARD", "PPE_VIOLATION"] },
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),
      (prisma as any).setting.findUnique({
        where: { key: "ehsObservationQuota" },
      }),
    ]);
    const quota = Number(quotaSetting?.value || 4);
    const byReporter: Record<string, number> = {};
    incidents.forEach((i: any) => {
      const name = String(i.reportedBy || "").trim();
      if (name) byReporter[name] = (byReporter[name] || 0) + 1;
    });
    const below = users.filter((u: any) => {
      const rolePerms: string[] = Array.isArray(u.role?.permissions)
        ? u.role.permissions
        : [];
      const isMgr =
        u.isOwner ||
        u.level === "MANAGER" ||
        rolePerms.includes("ehs.view") ||
        rolePerms.includes("system.view");
      return isMgr && (byReporter[u.name] || 0) < quota;
    });
    below.forEach((u: any) => {
      const done = byReporter[u.name] || 0;
      flags.push({
        id: `ehs-quota-${u.id}`,
        category: "EHS Observations",
        label: `Observation quota missed · ${u.name}`,
        detail: `${done}/${quota} safety observations this month — managers must log near-misses, hazards and PPE violations.`,
        severity: "warning",
        href: "/system/safety",
      });
    });
  } catch {
    // quota flag must never break the digest
  }

  // M23 — CLRA contractor licences: renewals due within 90 days are a digest flag,
  // expired licences are critical (contract labour cannot run on a lapsed licence).
  try {
    const contractors = await (prisma as any).contractor.findMany();
    contractors.forEach((c: any) => {
      const dueIn = Math.ceil(
        (new Date(c.licenseValidUntil).getTime() - now.getTime()) / 86400000,
      );
      if (dueIn <= 90) {
        flags.push({
          id: `clra-${c.id}`,
          category: "CLRA Licences",
          label: `${c.name} · ${c.licenseNumber} · ${dueIn <= 0 ? "LICENCE EXPIRED" : `renewal due in ${dueIn}d`}`,
          detail: c.gstin ? `GSTIN ${c.gstin}` : "contract labour",
          severity: dueIn <= 0 ? "critical" : "warning",
          href: "/people/clra",
        });
      }
    });
  } catch {
    // CLRA flags must never break the digest
  }

  // M25 — consent renewals: water/air pollution control consents within 90 days
  // of lapse are a digest flag; a lapsed consent is critical (plant cannot operate
  // on an expired consent).
  try {
    const consents = await (prisma as any).consent.findMany();
    consents.forEach((c: any) => {
      const dueIn = Math.ceil(
        (new Date(c.validUntil).getTime() - now.getTime()) / 86400000,
      );
      if (dueIn <= 90) {
        flags.push({
          id: `consent-${c.id}`,
          category: "Consent Renewals",
          label: `${c.type} consent · ${c.boardRef} · ${dueIn <= 0 ? "EXPIRED" : `renewal due in ${dueIn}d`}`,
          detail: `${c.consentNumber} · valid until ${new Date(c.validUntil).toLocaleDateString()}`,
          severity: dueIn <= 0 ? "critical" : "warning",
          href: "/ehs/consents",
        });
      }
    });
  } catch {
    // consent flags must never break the digest
  }

  // M30 — customer scorecards: our PPM >= 1000 or OTD < 90% is a digest flag;
  // PPM >= 5000 or OTD < 70% is critical (customer quality at risk).
  try {
    const scorecards = await (prisma as any).customerScorecard.findMany({
      orderBy: { receivedAt: "desc" },
      take: 50,
    });
    scorecards.forEach((s: any) => {
      const ppm = s.ppm !== null && s.ppm !== undefined ? Number(s.ppm) : null;
      const otp =
        s.otpPct !== null && s.otpPct !== undefined ? Number(s.otpPct) : null;
      const critical =
        (ppm !== null && ppm >= 5000) || (otp !== null && otp < 70);
      const flag = (ppm !== null && ppm >= 1000) || (otp !== null && otp < 90);
      if (flag) {
        flags.push({
          id: `scc-${s.id}`,
          category: "Customer Scorecards",
          label: `Scorecard poor · ${s.customerName} · ${s.period}`,
          detail: [
            ppm !== null ? `PPM ${ppm}` : "",
            otp !== null ? `OTD ${otp}%` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          severity: critical ? "critical" : "warning",
          href: "/commercial/scorecards",
        });
      }
    });
  } catch {
    // scorecard flags must never break the digest
  }

  // M31 — IT tickets past SLA: overdue HIGH/CRITICAL tickets are digest flags.
  try {
    const tickets = await (prisma as any).itTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        slaDueAt: true,
      },
    });
    tickets.forEach((t: any) => {
      if (
        new Date(t.slaDueAt).getTime() < now.getTime() &&
        ["HIGH", "CRITICAL"].includes(t.priority)
      ) {
        flags.push({
          id: `itt-${t.id}`,
          category: "IT Tickets",
          label: `SLA OVERDUE · ${t.ticketNumber} · ${t.priority}`,
          detail: t.title,
          severity: t.priority === "CRITICAL" ? "critical" : "warning",
          href: "/system/tickets",
        });
      }
    });
  } catch {
    // ticket flags must never break the digest
  }

  // Gage R&R — unacceptable measurement systems undermine SPC evidence
  grrStudies
    .filter((s: any) => s.verdict === "UNACCEPTABLE")
    .forEach((s: any) => {
      flags.push({
        id: `grr-${s.id}`,
        category: "Gage R&R",
        label: `Measurement system unacceptable · ${s.studyNumber}`,
        detail: `%GRR ${s.grrPct}% — tool cannot be trusted for SPC`,
        severity: "warning",
        href: "/quality/grr",
      });
    });

  function kpiUnit(t: string) {
    return t === "PPM" ? " ppm" : t === "MTBF" ? "h" : "%";
  }

  flags.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1,
  );

  return {
    flags,
    criticalCount: flags.filter((f) => f.severity === "critical").length,
    warningCount:
      flags.length - flags.filter((f) => f.severity === "critical").length,
  };
}
