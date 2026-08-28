import { prisma } from "./prisma";
import { getComplianceFlags } from "./complianceDigest";
import { getMissedObjectives } from "./qualityObjectives";

export type AgendaItem = {
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  source: string;
  href?: string;
};

/**
 * ISO 9001 cl.9.3 agenda — auto-pulled from live system state:
 *  1. compliance digest flags (critical/warning)
 *  2. missed quality objectives (target vs live actual)
 *  3. overdue/open action items from previous MRMs
 *  4. open escalations summary
 */
export async function buildMrmAgenda(
  now: Date = new Date(),
): Promise<AgendaItem[]> {
  const items: AgendaItem[] = [];

  // 1. Digest flags (critical first)
  const { flags } = await getComplianceFlags(now);
  flags.slice(0, 12).forEach((f) => {
    items.push({
      title: f.label,
      detail: f.detail,
      severity: f.severity,
      source: f.category,
      href: f.href,
    });
  });

  // 2. Missed quality objectives
  try {
    const missed = await getMissedObjectives(now);
    missed.forEach((m) => {
      const meta = m.objective.kpiType;
      items.push({
        title: `${m.objective.department} — ${meta} target missed`,
        detail: `Actual ${m.actual} vs target ${m.objective.targetValue} (${m.detail})`,
        severity: "warning",
        source: "Quality Objective",
        href: "/quality/objectives",
      });
    });
  } catch {
    // objectives must never break the agenda
  }

  // 3. Open action items from prior meetings (overdue = critical)
  try {
    const openActions = await prisma.mrmActionItem.findMany({
      where: { status: "OPEN" },
      include: { meeting: { select: { meetingNumber: true } } },
      orderBy: { dueDate: "asc" },
      take: 15,
    });
    openActions.forEach((a) => {
      const overdue = a.dueDate && a.dueDate < now;
      items.push({
        title: `Action item ${overdue ? "OVERDUE" : "open"} · ${a.description.slice(0, 80)}`,
        detail: `Owner ${a.ownerName} · due ${a.dueDate ? a.dueDate.toLocaleDateString() : "not set"} · from ${a.meeting.meetingNumber}`,
        severity: overdue ? "critical" : "info",
        source: "MRM Action",
        href: "/quality/mrm",
      });
    });
  } catch {
    // fine
  }

  // 4. Open escalations summary
  try {
    const open = await prisma.escalation.count({
      where: { status: { not: "RESOLVED" } },
    });
    if (open > 0) {
      items.push({
        title: `${open} open escalation${open > 1 ? "s" : ""} awaiting disposition`,
        detail: "Review status, owners and due dates of open escalations",
        severity: "warning",
        source: "Escalations",
        href: "/system/escalations",
      });
    }
  } catch {
    // fine
  }

  return items;
}
