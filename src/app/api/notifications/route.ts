import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import { getComplianceFlags } from "@/lib/complianceDigest";
import { DEPARTMENTS, matchDepartmentKey } from "@/lib/departments";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tokenStr = req.cookies.get("app_session")?.value;
    if (!tokenStr) return NextResponse.json({ notifications: [] });

    const token = await verifySessionToken(tokenStr);
    if (!token) return NextResponse.json({ notifications: [] });

    const isOwner = token.isOwner;
    const permissions = token.permissions || [];

    // Build permission check helper
    const hasPerm = (perm: string) => isOwner || permissions.includes(perm);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

    // Map departments to their notification-relevant permissions and queries
    const departmentNotifications = [
      // HR / People
      {
        check: () => hasPerm("people.edit") || hasPerm("people.view"),
        query: async () => {
          const pendingLeaves = await prisma.leaveRequest.count({
            where: { status: "PENDING" },
          });
          if (pendingLeaves > 0) {
            return {
              id: "hr-leaves",
              title: "Pending Leave Approvals",
              description: `${pendingLeaves} leave request(s) waiting for approval.`,
              type: "warning" as const,
              link: "/people/pulse",
            };
          }
          return null;
        },
      },
      // M23 — CLRA contractor licence renewals: renewals within 90 days warn,
      // any expired licence is a danger bell for HR.
      {
        check: () => hasPerm("people.edit") || hasPerm("people.view"),
        query: async () => {
          const contractors = await prisma.contractor.findMany({
            select: {
              name: true,
              licenseNumber: true,
              licenseValidUntil: true,
            },
          });
          const nowMs = Date.now();
          const expiring = contractors.filter((c) => {
            const due = new Date(c.licenseValidUntil).getTime() - nowMs;
            return due <= 90 * 86400000;
          });
          if (expiring.length > 0) {
            const expired = expiring.filter(
              (c) => new Date(c.licenseValidUntil).getTime() <= nowMs,
            );
            const soon = expiring
              .filter((c) => !expired.includes(c))
              .sort(
                (a, b) =>
                  new Date(a.licenseValidUntil).getTime() -
                  new Date(b.licenseValidUntil).getTime(),
              )
              .slice(0, 3);
            return {
              id: "clra-licenses",
              title:
                expired.length > 0
                  ? `CLRA — ${expired.length} licence(s) EXPIRED`
                  : `CLRA — ${expiring.length} licence renewal(s) due`,
              description:
                expired.length > 0
                  ? `Expired: ${expired.map((c) => c.name).join(", ")}. Due soon: ${soon.map((c) => `${c.name} (${c.licenseNumber})`).join(", ") || "—"}. Contract labour cannot run on lapsed licences.`
                  : `${soon.map((c) => `${c.name} · ${c.licenseNumber}`).join(", ")} — renew before ${expiring.length > 3 ? "the rest " : ""}lapse.`,
              type: (expired.length > 0 ? "danger" : "warning") as
                "danger" | "warning",
              link: "/people/clra",
            };
          }
          return null;
        },
      },
      // M25 — consent renewals: water/air pollution control consents within 90
      // days of lapse warn, any expired consent is a danger bell for EHS.
      {
        check: () => hasPerm("ehs.edit") || hasPerm("ehs.view"),
        query: async () => {
          const consents = await prisma.consent.findMany({
            select: {
              consentNumber: true,
              type: true,
              boardRef: true,
              validUntil: true,
            },
          });
          const nowMs = Date.now();
          const expiring = consents.filter(
            (c) => new Date(c.validUntil).getTime() - nowMs <= 90 * 86400000,
          );
          if (expiring.length > 0) {
            const expired = expiring.filter(
              (c) => new Date(c.validUntil).getTime() <= nowMs,
            );
            const soon = expiring
              .filter((c) => !expired.includes(c))
              .sort(
                (a, b) =>
                  new Date(a.validUntil).getTime() -
                  new Date(b.validUntil).getTime(),
              )
              .slice(0, 3);
            return {
              id: "consents-renewal",
              title:
                expired.length > 0
                  ? `Consents - ${expired.length} consent(s) EXPIRED`
                  : `Consents - ${expiring.length} renewal(s) due`,
              description:
                expired.length > 0
                  ? `Expired: ${expired.map((c) => `${c.type} ${c.boardRef}`).join(", ")}. Due soon: ${soon.map((c) => `${c.type} ${c.boardRef}`).join(", ") || "-"}. Plant cannot operate on an expired consent.`
                  : `${soon.map((c) => `${c.type} ${c.boardRef}`).join(", ")} - renew before ${expiring.length > 3 ? "the rest " : ""}lapse.`,
              type: (expired.length > 0 ? "danger" : "warning") as
                "danger" | "warning",
              link: "/ehs/consents",
            };
          }
          return null;
        },
      },
      // Risk register — HIGH/CRITICAL open risks are a danger bell, overdue
      // quarterly reviews warn. Both link to the register page.
      {
        check: () =>
          hasPerm("system.view") || hasPerm("system.edit") || hasPerm("exec.view"),
        query: async () => {
          const risks = await prisma.riskRegister.findMany({
            where: { status: { not: "CLOSED" } },
            select: {
              id: true,
              riskCode: true,
              title: true,
              riskLevel: true,
              reviewDueAt: true,
            },
          });
          const critical = risks.filter(
            (r) => r.riskLevel === "CRITICAL" || r.riskLevel === "HIGH",
          );
          const overdue = risks.filter(
            (r) => r.reviewDueAt && new Date(r.reviewDueAt).getTime() < Date.now(),
          );
          if (critical.length > 0 || overdue.length > 0) {
            const danger = critical.filter((r) => r.riskLevel === "CRITICAL").length;
            return {
              id: "risk-register",
              title:
                critical.length > 0
                  ? `Risk register — ${critical.length} HIGH/CRITICAL open risk${critical.length === 1 ? "" : "s"}`
                  : `Risk register — ${overdue.length} review${overdue.length === 1 ? "" : "s"} overdue`,
              description: `${danger > 0 ? `${danger} critical · ` : ""}${critical
                .slice(0, 3)
                .map((r) => `${r.riskCode} ${r.riskLevel}`)
                .join(", ")}${overdue.length > 0 ? ` · ${overdue.length} review overdue` : ""} — review in the register.`,
              type: (critical.length > 0 ? "danger" : "warning") as
                | "danger"
                | "warning",
              link: "/system/risk-register",
            };
          }
          return null;
        },
      },
      // M31 — IT tickets: any ticket past its SLA due is a danger bell, open
      // tickets with SLA approaching warn the IT team.
      {
        check: () => hasPerm("system.edit") || hasPerm("system.view"),
        query: async () => {
          const tickets = await prisma.itTicket.findMany({
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
            select: {
              ticketNumber: true,
              title: true,
              priority: true,
              slaDueAt: true,
            },
          });
          const nowMs = Date.now();
          const overdue = tickets.filter(
            (t) => new Date(t.slaDueAt).getTime() < nowMs,
          );
          const approaching = tickets.filter((t) => {
            const left = new Date(t.slaDueAt).getTime() - nowMs;
            return left >= 0 && left <= 24 * 3600000;
          });
          if (overdue.length > 0) {
            const crits = overdue.filter(
              (t) => t.priority === "CRITICAL",
            ).length;
            return {
              id: "it-tickets",
              title: `IT Tickets - ${overdue.length} past SLA${crits > 0 ? ` (${crits} CRITICAL)` : ""}`,
              description: `${overdue
                .map((t) => t.ticketNumber)
                .slice(0, 5)
                .join(
                  ", ",
                )}${overdue.length > 5 ? ` +${overdue.length - 5} more` : ""} - ${approaching.length > 0 ? `${approaching.length} more due within 24h. ` : ""}SLA is ${overdue[0]?.slaDueAt ? `tracked against ${overdue[0].slaDueAt.toISOString().slice(0, 16).replace("T", " ")}` : "active"}.`,
              type: "danger" as const,
              link: "/system/tickets",
            };
          }
          if (tickets.length > 0 && approaching.length > 0) {
            return {
              id: "it-tickets-soon",
              title: `IT Tickets - ${approaching.length} within 24h of SLA`,
              description: approaching.map((t) => t.ticketNumber).join(", "),
              type: "warning" as const,
              link: "/system/tickets",
            };
          }
          return null;
        },
      },
      // Supply Chain
      {
        check: () => hasPerm("supply.edit") || hasPerm("supply.view"),
        query: async () => {
          const materials = await prisma.rawMaterial.findMany({
            where: { isActive: true },
            select: { id: true, currentStock: true, minStock: true },
          });
          const lowStockCount = materials.filter(
            (m) => m.currentStock <= m.minStock,
          ).length;
          if (lowStockCount > 0) {
            return {
              id: "supply-stock",
              title: "Low Stock Alert",
              description: `${lowStockCount} raw material(s) are at or below minimum stock levels.`,
              type: "danger" as const,
              link: "/supply/vault",
            };
          }
          // P14 — overdue POs: auto reminder to the buyer(s).
          const overduePos = await prisma.purchaseOrder.findMany({
            where: {
              status: { in: ["ORDERED", "PARTIAL"] },
              expectedDate: { lt: now },
            },
            include: { supplier: true },
            orderBy: { expectedDate: "asc" },
            take: 20,
          });
          if (overduePos.length > 0) {
            return {
              id: "supply-overdue-po",
              title: "Overdue POs — Buyer Reminder",
              description: `${overduePos.length} purchase order(s) past expected date: ${overduePos
                .slice(0, 3)
                .map((p) => p.poNumber)
                .join(
                  ", ",
                )}${overduePos.length > 3 ? "…" : ""} — chase the suppliers.`,
              type: "danger" as const,
              link: "/supply/buyer-board",
            };
          }
          return null;
        },
      },
      // Quality
      {
        check: () => hasPerm("quality.edit") || hasPerm("quality.view"),
        query: async () => {
          const [openNcrs, open8d, ppapPending] = await Promise.all([
            prisma.ncrReport.count({ where: { status: "OPEN" } }),
            prisma.eightDReport.count({ where: { status: { not: "CLOSED" } } }),
            prisma.ppapSubmission.count({
              where: { status: { in: ["SUBMITTED", "IN_PROGRESS"] } },
            }),
          ]);
          const total = openNcrs + open8d + ppapPending;
          if (total > 0) {
            return {
              id: "quality-alerts",
              title: "Quality Actions Required",
              description: `${openNcrs} open NCR(s), ${open8d} active 8D(s), ${ppapPending} PPAP pending.`,
              type: openNcrs > 0 ? "danger" : "warning",
              link: "/quality/hub",
            };
          }
          return null;
        },
      },
      // M8 — Complaint SLA breaches bell the exec / commercial / quality viewers
      {
        check: () =>
          hasPerm("exec.view") ||
          hasPerm("commercial.view") ||
          hasPerm("quality.view"),
        query: async () => {
          const complaints = await prisma.customerComplaint.findMany({
            where: { status: { not: "CLOSED" } },
            select: {
              id: true,
              complaintNumber: true,
              ackDeadline: true,
              ackAt: true,
              eightDDeadline: true,
              eightDClosedAt: true,
              customerName: true,
            },
          });
          const now = Date.now();
          const ackBreached = complaints.filter(
            (c: any) =>
              c.ackDeadline &&
              !c.ackAt &&
              new Date(c.ackDeadline).getTime() < now,
          );
          const eightDBreached = complaints.filter(
            (c: any) =>
              c.eightDDeadline &&
              !c.eightDClosedAt &&
              new Date(c.eightDDeadline).getTime() < now,
          );
          const parts: string[] = [];
          if (ackBreached.length)
            parts.push(
              `${ackBreached.length} ack overdue (24h SLA): ${ackBreached.map((c: any) => c.complaintNumber).join(", ")}`,
            );
          if (eightDBreached.length)
            parts.push(
              `${eightDBreached.length} 8D overdue (10d SLA): ${eightDBreached.map((c: any) => c.complaintNumber).join(", ")}`,
            );
          if (parts.length > 0) {
            return {
              id: "complaint-sla",
              title: "Customer SLA breach",
              description: parts.join(" · "),
              type: "danger" as const,
              link: "/complaints",
            };
          }
          return null;
        },
      },
      // Finance
      {
        check: () => hasPerm("finance.edit") || hasPerm("finance.view"),
        query: async () => {
          const [unpaidInvoices, overdueReceivables] = await Promise.all([
            (prisma as any).invoice.count({
              where: { status: { in: ["UNPAID", "PARTIAL"] } },
            }),
            (prisma as any).invoice.count({
              where: {
                status: { in: ["UNPAID", "PARTIAL"] },
                dueDate: { lt: now },
              },
            }),
          ]);
          if (unpaidInvoices > 0 || overdueReceivables > 0) {
            return {
              id: "finance-alerts",
              title: "Finance Items Need Attention",
              description: `${unpaidInvoices} unpaid invoice(s), ${overdueReceivables} overdue receivable(s).`,
              type: overdueReceivables > 0 ? "danger" : "warning",
              link: "/finance/hub",
            };
          }
          return null;
        },
      },
      // Maintenance
      {
        check: () => hasPerm("maintenance.edit") || hasPerm("maintenance.view"),
        query: async () => {
          const [openJobs] = await Promise.all([
            prisma.maintenanceJob.count({
              where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
            }),
            prisma.pMRule.count({
              where: {
                isActive: true,
                lastDoneAt: { not: null },
                // PM is overdue if lastDoneAt + intervalDays < now
              },
            }),
          ]);
          // Calculate overdue PM from lastDoneAt + intervalDays
          const pmRules = await prisma.pMRule.findMany({
            where: { isActive: true, lastDoneAt: { not: null } },
            select: { lastDoneAt: true, intervalDays: true },
          });
          const overduePMCount = pmRules.filter((p) => {
            if (!p.lastDoneAt || !p.intervalDays) return false;
            const dueDate = new Date(
              p.lastDoneAt.getTime() + p.intervalDays * 86400000,
            );
            return dueDate < now;
          }).length;

          if (openJobs > 0 || overduePMCount > 0) {
            return {
              id: "maintenance-alerts",
              title: "Maintenance Tasks Pending",
              description: `${openJobs} open job(s), ${overduePMCount} overdue PM schedule(s).`,
              type: overduePMCount > 0 ? "danger" : "warning",
              link: "/maintenance",
            };
          }
          return null;
        },
      },
      // EHS
      {
        check: () => hasPerm("ehs.edit") || hasPerm("ehs.view"),
        query: async () => {
          const [openIncidents, overdueAudits] = await Promise.all([
            (prisma as any).safetyIncident.count({
              where: { status: { in: ["OPEN", "INVESTIGATING"] } },
            }),
            (prisma as any).qmsAudit.count({
              where: {
                status: { in: ["PLANNED", "IN_PROGRESS"] },
                scheduledDate: { lt: now },
              },
            }),
          ]);
          if (openIncidents > 0 || overdueAudits > 0) {
            return {
              id: "ehs-alerts",
              title: "EHS Actions Required",
              description: `${openIncidents} open incident(s), ${overdueAudits} overdue audit(s).`,
              type: "danger",
              link: "/ehs",
            };
          }
          return null;
        },
      },
      // Projects
      {
        check: () => hasPerm("projects.edit") || hasPerm("projects.view"),
        query: async () => {
          const overdueProjects = await prisma.project.count({
            where: {
              status: { in: ["OPEN", "IN_PROGRESS"] },
              targetCompletionDate: { lt: now },
            },
          });
          if (overdueProjects > 0) {
            return {
              id: "projects-alerts",
              title: "Overdue Projects",
              description: `${overdueProjects} open project(s) are past their target completion date.`,
              type: "warning",
              link: "/projects",
            };
          }
          return null;
        },
      },
      // Engineering / R&D
      {
        check: () => hasPerm("engineering.edit") || hasPerm("engineering.view"),
        query: async () => {
          const [openEcos, pendingFais] = await Promise.all([
            prisma.eco.count({
              where: { status: { in: ["DRAFT", "APPROVED"] } },
            }),
            prisma.faiReport.count({ where: { status: "IN_PROGRESS" } }),
          ]);
          if (openEcos > 0 || pendingFais > 0) {
            return {
              id: "engineering-alerts",
              title: "Engineering Items Pending",
              description: `${openEcos} ECO(s) in review, ${pendingFais} FAI(s) in progress.`,
              type: "info",
              link: "/engineering",
            };
          }
          return null;
        },
      },
      // Metrology
      {
        check: () => hasPerm("metrology.edit") || hasPerm("metrology.view"),
        query: async () => {
          const [expiredTools, expiringSoon] = await Promise.all([
            prisma.calibratedTool.count({ where: { expiresAt: { lt: now } } }),
            prisma.calibratedTool.count({
              where: { expiresAt: { gte: now, lte: thirtyDaysFromNow } },
            }),
          ]);
          if (expiredTools > 0 || expiringSoon > 0) {
            return {
              id: "metrology-alerts",
              title: "Calibration Alerts",
              description: `${expiredTools} expired tool(s), ${expiringSoon} expiring within 30 days.`,
              type: expiredTools > 0 ? "danger" : "warning",
              link: "/metrology",
            };
          }
          return null;
        },
      },
      // Commercial / Sales
      {
        check: () => hasPerm("commercial.edit") || hasPerm("commercial.view"),
        query: async () => {
          const [openComplaints, openQuotes, quotations, revisions] =
            await Promise.all([
              prisma.customerComplaint.count({
                where: { status: { not: "CLOSED" } },
              }),
              (prisma as any).quotation.count({
                where: { status: { in: ["DRAFT", "SENT"] } },
              }),
              (prisma as any).quotation.findMany({
                where: { status: { in: ["DRAFT", "SENT"] } },
                select: {
                  id: true,
                  quoteNumber: true,
                  createdAt: true,
                  lastFollowUpAt: true,
                },
              }),
              (prisma as any).priceRevision.findMany({
                where: { status: "APPROVED" },
                select: { id: true, productId: true, effectiveDate: true },
              }),
            ]);
          // P20 — enquiries idle > 7 days (no follow-up logged)
          const idleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const idleCount = quotations.filter((q: any) => {
            const last = q.lastFollowUpAt
              ? new Date(q.lastFollowUpAt)
              : new Date(q.createdAt);
            return last < idleCutoff;
          }).length;
          // P19 — annual price reviews due within 30 days
          const dueCutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const priceDue = revisions.filter((r: any) => {
            const next = new Date(
              new Date(r.effectiveDate).getTime() + 365 * 24 * 60 * 60 * 1000,
            );
            return next <= dueCutoff;
          }).length;
          if (idleCount > 0 || priceDue > 0) {
            return {
              id: "commercial-followup",
              title: "Sales follow-ups due",
              description: `${idleCount} enquiry(ies) idle > 7 days, ${priceDue} annual price review(s) due within 30 days.`,
              type: idleCount > 0 ? "warning" : "info",
              link: "/commercial/follow-ups",
            };
          }
          if (openComplaints > 0 || openQuotes > 0) {
            return {
              id: "commercial-alerts",
              title: "Commercial Actions Needed",
              description: `${openComplaints} open complaint(s), ${openQuotes} pending quotation(s).`,
              type: openComplaints > 0 ? "danger" : "warning",
              link: "/commercial/desk",
            };
          }
          return null;
        },
      },
      // P30 — Access review: auto-suspended users from a lapsed quarterly review
      {
        check: () => hasPerm("system.view") || hasPerm("system.edit"),
        query: async () => {
          const closed = await prisma.accessReviewCycle.findFirst({
            where: { status: "CLOSED" },
            orderBy: { closedAt: "desc" },
            include: { certifications: true },
          });
          const suspended = await prisma.auditLog.count({
            where: {
              action: "ACCESS_SUSPENDED",
              at: { gte: new Date(Date.now() - 7 * 86400000) },
            },
          });
          const pending = await prisma.accessReviewCycle.findFirst({
            where: { status: "OPEN" },
            include: { certifications: true },
            orderBy: { dueDate: "desc" },
          });
          if (suspended > 0) {
            return {
              id: "access-review-suspended",
              title: "Access review — users auto-suspended",
              description: `${suspended} user(s) suspended in the last 7 days for missing certification in "${closed?.name || "review"}". Restore after re-certification.`,
              type: "danger" as const,
              link: "/system/access-review",
            };
          }
          if (pending) {
            const pendingCount =
              (await prisma.user.count({ where: { isActive: true } })) -
              pending.certifications.length;
            const daysLeft = Math.ceil(
              (new Date(pending.dueDate).getTime() - Date.now()) / 86400000,
            );
            if (pendingCount > 0 && daysLeft <= 14) {
              return {
                id: "access-review-due",
                title: "Access review due",
                description: `${pendingCount} user(s) uncertified in "${pending.name}" — due in ${daysLeft} day(s). Uncertified users auto-suspend.`,
                type: "warning" as const,
                link: "/system/access-review",
              };
            }
          }
          return null;
        },
      },
      // M5 — Hourly andon: machines with 2+ short hours today bell the supervisor
      {
        check: () => hasPerm("ops.view") || hasPerm("ops.edit"),
        query: async () => {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(todayStart.getTime() + 86400000);
          const [wos, logs] = await Promise.all([
            prisma.workOrder.findMany({
              where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
              include: { product: { include: { routingSteps: true } } },
            }),
            prisma.productionLog.findMany({
              where: { startTime: { gte: todayStart, lt: todayEnd } },
              include: { machine: { select: { name: true } } },
            }),
          ]);
          const target = new Map<string, number>();
          for (const wo of wos) {
            for (const step of wo.product?.routingSteps || []) {
              if (!step.machineId) continue;
              const cycleSec = step.cycleTimeMin ? step.cycleTimeMin * 60 : 60;
              target.set(
                step.machineId,
                Math.max(1, Math.round(3600 / cycleSec)),
              );
              break;
            }
          }
          const machines = await prisma.machine.findMany();
          const flagged: string[] = [];
          const now = new Date();
          for (const m of machines) {
            const t = target.get(m.id) || 0;
            if (!t) continue;
            let short = 0;
            for (let h = 0; h < now.getHours(); h++) {
              const actual = logs
                .filter(
                  (l) =>
                    l.machineId === m.id &&
                    new Date(l.startTime).getHours() === h,
                )
                .reduce((s, l) => s + l.goodQuantity + l.scrapQuantity, 0);
              if (actual < t) short++;
            }
            if (short >= 2) flagged.push(m.name);
          }
          if (flagged.length > 0) {
            return {
              id: "hourly-andon",
              title: "Hourly andon — machines running short",
              description: `${flagged.length} machine(s) missed target in 2+ hours today: ${flagged.join(", ")}. Check output.`,
              type: "warning" as const,
              link: "/ops/andon",
            };
          }
          return null;
        },
      },
      // P29 — Program health: at-risk programs bell the sales owner / exec / projects viewers
      {
        check: () =>
          hasPerm("projects.view") ||
          hasPerm("commercial.view") ||
          hasPerm("exec.view"),
        query: async () => {
          const projects = await prisma.project.findMany({
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
            include: {
              workOrders: { select: { plannedEndDate: true, status: true } },
            },
          });
          const now = Date.now();
          const highRisk = projects.filter((p: any) => {
            const open = (p.workOrders || []).filter(
              (w: any) => w.status !== "COMPLETED",
            );
            return (
              open.some(
                (w: any) => new Date(w.plannedEndDate).getTime() < now,
              ) ||
              (open.length > 0 &&
                new Date(p.targetCompletionDate).getTime() < now)
            );
          });
          if (highRisk.length > 0) {
            return {
              id: "program-health",
              title: "Program Health — at risk",
              description: `${highRisk.length} program(s) have slipped work orders: ${highRisk.map((p: any) => p.code).join(", ")}. Sales owner must act.`,
              type: "danger" as const,
              link: "/projects",
            };
          }
          return null;
        },
      },
      // Budget — P21 cost-center ownership: overruns for the departments THIS user can see
      {
        check: () =>
          hasPerm("finance.edit") ||
          hasPerm("finance.view") ||
          hasPerm("exec.view"),
        query: async () => {
          const lines = await prisma.budgetLine.findMany();
          const overruns = lines.filter((l: any) => {
            const allocated = Number(l.allocated) || 0;
            const spent = Number(l.spent) || 0;
            return allocated > 0 && spent > allocated;
          });
          const visible = overruns.filter((l: any) => {
            const key = matchDepartmentKey(l.department);
            if (!key) return true; // unmatched dept names are finance's concern
            const d = DEPARTMENTS.find((dd) => dd.id === key);
            return d ? hasPerm(d.permissionKey) : false;
          });
          if (visible.length > 0) {
            return {
              id: "budget-overruns",
              title: "Cost-center overruns",
              description: `${visible.length} budget line(s) over allocated — ${visible
                .map((l: any) => `${l.department}/${l.category}`)
                .slice(0, 3)
                .join(", ")}${visible.length > 3 ? "…" : ""}.`,
              type: "danger" as const,
              link: "/commercial/treasury",
            };
          }
          return null;
        },
      },
      // Executive (Owners only - show high-level)
      {
        check: () => isOwner,
        query: async () => {
          const [totalOpenNcrs, totalLowStock, totalOpenIncidents] =
            await Promise.all([
              prisma.ncrReport.count({ where: { status: "OPEN" } }),
              prisma.rawMaterial.count({
                where: {
                  isActive: true,
                  currentStock: { lte: prisma.rawMaterial.fields.minStock },
                },
              }),
              (prisma as any).safetyIncident.count({
                where: { status: { in: ["OPEN", "INVESTIGATING"] } },
              }),
            ]);
          if (
            totalOpenNcrs > 0 ||
            totalLowStock > 0 ||
            totalOpenIncidents > 0
          ) {
            return {
              id: "exec-summary",
              title: "Executive Summary Alerts",
              description: `${totalOpenNcrs} NCRs, ${totalLowStock} low stock, ${totalOpenIncidents} incidents.`,
              type: "warning",
              link: "/command",
            };
          }
          return null;
        },
      },
      // System / IT
      {
        check: () => hasPerm("system.edit") || hasPerm("system.view"),
        query: async () => {
          const { criticalCount } = await getComplianceFlags(now);
          const openEscalations = await prisma.escalation.count({
            where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          });
          if (criticalCount > 0 || openEscalations > 0) {
            return {
              id: "sys-alerts",
              title: "System Compliance & Escalations",
              description: `${criticalCount} compliance flags, ${openEscalations} open escalation(s).`,
              type: criticalCount > 0 ? "danger" : "warning",
              link: "/system/health",
            };
          }
          return null;
        },
      },
      // M27 — Spares: below reorder point or unclassified ABC bell maintenance / supply
      {
        check: () =>
          hasPerm("maintenance.edit") ||
          hasPerm("maintenance.view") ||
          hasPerm("supply.edit") ||
          hasPerm("supply.view"),
        query: async () => {
          const spares = await prisma.sparePart.findMany({
            select: {
              name: true,
              sku: true,
              currentQty: true,
              minQty: true,
              abcClass: true,
              leadTimeDays: true,
              avgDailyUsage: true,
            },
          });
          const below = spares.filter((s) => {
            const rp =
              s.leadTimeDays && Number(s.avgDailyUsage) > 0
                ? Math.ceil(Number(s.leadTimeDays) * Number(s.avgDailyUsage))
                : Number(s.minQty || 0);
            return s.currentQty <= (rp > 0 ? rp : s.minQty || 0);
          });
          const unclassified = spares.filter((s) => !s.abcClass).length;
          if (below.length > 0) {
            return {
              id: "spares-reorder",
              title: `Spares — ${below.length} below reorder point`,
              description: `${below
                .slice(0, 5)
                .map((s) => s.name)
                .join(
                  ", ",
                )}${below.length > 5 ? ` +${below.length - 5} more` : ""}${unclassified > 0 ? ` · ${unclassified} unclassified for ABC` : ""}.`,
              type: "danger" as const,
              link: "/maintenance/spares-abc",
            };
          }
          if (unclassified > 0) {
            return {
              id: "spares-abc",
              title: "Spares — ABC classification pending",
              description: `${unclassified} spare(s) have no ABC class — run auto-classify.`,
              type: "warning" as const,
              link: "/maintenance/spares-abc",
            };
          }
          return null;
        },
      },
      // M28 — Utilities: no meter reading in the last 3 days means the daily log is slipping
      {
        check: () =>
          hasPerm("maintenance.edit") ||
          hasPerm("maintenance.view") ||
          hasPerm("system.edit") ||
          hasPerm("system.view"),
        query: async () => {
          const cutoff = new Date(Date.now() - 3 * 86400000);
          const last = await prisma.utilityReading.findFirst({
            orderBy: { readAt: "desc" },
            select: { readAt: true },
          });
          if (last && new Date(last.readAt).getTime() < cutoff.getTime()) {
            return {
              id: "utilities-log",
              title: "Utilities log stale",
              description: `Last meter reading was ${new Date(last.readAt).toLocaleDateString("en-IN")} — log daily readings (power / air / water / gas).`,
              type: "warning" as const,
              link: "/maintenance/utilities",
            };
          }
          return null;
        },
      },
      // M29 — Milestone doc packs: undelivered docs or past-due milestones bell the projects team
      {
        check: () => hasPerm("projects.edit") || hasPerm("projects.view"),
        query: async () => {
          const milestones = await prisma.projectMilestone.findMany({
            where: { status: { not: "COMPLETED" } },
            include: {
              docs: { select: { deliveredAt: true } },
              project: { select: { name: true } },
            },
          });
          const undelivered = milestones.reduce(
            (n, m) => n + m.docs.filter((d) => !d.deliveredAt).length,
            0,
          );
          const pastDue = milestones.filter(
            (m) => new Date(m.dueDate).getTime() < now.getTime(),
          );
          if (pastDue.length > 0) {
            return {
              id: "milestones-due",
              title: `Milestones — ${pastDue.length} past due`,
              description: `${pastDue
                .slice(0, 3)
                .map((m) => `${m.name} (${m.project.name})`)
                .join(
                  ", ",
                )}${pastDue.length > 3 ? ` +${pastDue.length - 3} more` : ""} — complete the doc pack to gate invoice.`,
              type: "danger" as const,
              link: "/projects/milestones",
            };
          }
          if (undelivered > 0) {
            return {
              id: "milestone-docs",
              title: `Milestone doc packs — ${undelivered} docs undelivered`,
              description:
                "A milestone cannot be marked complete until every doc in its pack is delivered.",
              type: "warning" as const,
              link: "/projects/milestones",
            };
          }
          return null;
        },
      },
      // M30 — Customer scorecards: none recorded this month, or the latest scored card is poor
      {
        check: () =>
          hasPerm("quality.edit") ||
          hasPerm("quality.view") ||
          hasPerm("commercial.edit") ||
          hasPerm("commercial.view"),
        query: async () => {
          const thisMonth = now.toISOString().slice(0, 7);
          const cards = await prisma.customerScorecard.findMany({
            orderBy: { period: "desc" },
            take: 12,
          });
          if (cards.length === 0) {
            return {
              id: "scorecards-none",
              title: "Customer scorecards — none recorded",
              description: `No scorecards on file. Record the monthly customer-scored PPM / OTD for ${thisMonth}.`,
              type: "warning" as const,
              link: "/commercial/scorecards",
            };
          }
          const latest = cards[0];
          const ppm =
            latest.ppm !== null && latest.ppm !== undefined
              ? Number(latest.ppm)
              : null;
          const otp =
            latest.otpPct !== null && latest.otpPct !== undefined
              ? Number(latest.otpPct)
              : null;
          const critical =
            (ppm !== null && ppm >= 5000) || (otp !== null && otp < 70);
          const warning =
            (ppm !== null && ppm >= 1000) || (otp !== null && otp < 90);
          if (critical || warning) {
            return {
              id: "scorecards-poor",
              title: `Scorecard ${latest.period} — ${critical ? "CRITICAL" : "WARNING"} for ${latest.customerName}`,
              description: `${ppm !== null ? `PPM ${ppm}` : ""}${ppm !== null && otp !== null ? " · " : ""}${otp !== null ? `OTD ${otp}%` : ""}${latest.score !== null && latest.score !== undefined ? ` · score ${latest.score}` : ""}.`,
              type: critical ? ("danger" as const) : ("warning" as const),
              link: "/commercial/scorecards",
            };
          }
          return null;
        },
      },
    ];

    // Execute all department notification queries in parallel
    const results = await Promise.all(
      departmentNotifications.filter((d) => d.check()).map((d) => d.query()),
    );

    const notifications = results.filter(
      (n): n is NonNullable<typeof n> => n !== null,
    );

    // Attach read/acknowledge state for the current user
    const reads = new Set<string>();
    if (token?.id) {
      const readRows = await prisma.notificationRead.findMany({
        where: { userId: token.id },
        select: { notificationId: true },
      });
      readRows.forEach((r) => reads.add(r.notificationId));
    }
    const items = notifications.map((n) => ({ ...n, read: reads.has(n.id) }));

    return NextResponse.json({ notifications: items });
  } catch (err) {
    console.error("Notifications API error:", err);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}
