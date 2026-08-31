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
 * ISO 9001 cl.9.3 Management Review Meeting (MRM) Agenda Engine.
 * Grounded in ISO 9001:2015 Clause 9.3 (Management Review Inputs):
 *  1. Compliance digest flags (critical & warning)
 *  2. Quality objectives target vs actual drift
 *  3. Overdue and open CAPA / MRM action items
 *  4. Open system escalations and customer dissatisfaction signals
 */
export async function buildMrmAgenda(
  now: Date = new Date(),
): Promise<AgendaItem[]> {
  const items: AgendaItem[] = [];
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  // 1. Digest flags (critical first)
  try {
    const { flags } = await getComplianceFlags(safeNow);
    (flags || []).forEach((f) => {
      items.push({
        title: f.label,
        detail: f.detail,
        severity: f.severity,
        source: f.category,
        href: f.href,
      });
    });
  } catch (err) {
    console.error("Failed to fetch compliance flags for MRM agenda:", err);
  }

  // 2. Missed quality objectives
  try {
    const missed = await getMissedObjectives(safeNow);
    (missed || []).forEach((m) => {
      if (!m) return;
      const dept = m.objective?.department || "Plant";
      const meta = m.objective?.kpiType || "KPI";
      const targetVal = m.objective?.targetValue ?? "Target";
      const detailStr = m.detail ? ` (${m.detail})` : "";

      items.push({
        title: `${dept} — ${meta} target missed`,
        detail: `Actual ${m.actual ?? "—"} vs target ${targetVal}${detailStr}`,
        severity: "warning",
        source: "Quality Objective",
        href: "/quality/objectives",
      });
    });
  } catch (err) {
    console.error("Failed to fetch missed objectives for MRM agenda:", err);
  }

  // 3. Open action items from prior meetings (overdue = critical)
  try {
    const openActions = await prisma.mrmActionItem.findMany({
      where: { status: "OPEN" },
      include: { meeting: { select: { meetingNumber: true } } },
      orderBy: { dueDate: "asc" },
      take: 25,
    });

    openActions.forEach((a) => {
      const dueTime = a.dueDate ? new Date(a.dueDate).getTime() : null;
      const overdue = dueTime !== null && !isNaN(dueTime) && dueTime < safeNow.getTime();
      const dateFormatted = a.dueDate && !isNaN(new Date(a.dueDate).getTime())
        ? new Date(a.dueDate).toLocaleDateString("en-IN")
        : "not set";

      items.push({
        title: `Action item ${overdue ? "OVERDUE" : "open"} · ${a.description.slice(0, 100)}`,
        detail: `Owner ${a.ownerName || "Unassigned"} · due ${dateFormatted} · from ${a.meeting?.meetingNumber || "MRM"}`,
        severity: overdue ? "critical" : "info",
        source: "MRM Action",
        href: "/quality/mrm",
      });
    });
  } catch (err) {
    console.error("Failed to fetch open MRM action items:", err);
  }

  // 4. Open escalations summary
  try {
    const open = await prisma.escalation.count({
      where: { status: { not: "RESOLVED" } },
    });
    if (open > 0) {
      items.push({
        title: `${open} open escalation${open > 1 ? "s" : ""} awaiting disposition`,
        detail: "Review root cause containment, owners, and closure deadlines",
        severity: "warning",
        source: "Escalations",
        href: "/system/escalations",
      });
    }
  } catch (err) {
    console.error("Failed to count open escalations for MRM:", err);
  }

  return items;
}
