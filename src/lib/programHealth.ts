import { prisma } from "./prisma";

export type ProgramRisk = "HIGH" | "MEDIUM" | "LOW";

export type ProgramHealth = {
  projectId: string;
  code: string;
  name: string;
  clientName: string;
  status: string;
  salesOwner: string | null;
  targetCompletionDate: Date;
  risk: ProgramRisk;
  overdueWos: { woNumber: string; plannedEndDate: Date; status: string }[];
  dueSoonWos: { woNumber: string; plannedEndDate: Date; status: string }[];
  slippedMilestones: { name: string; dueDate: Date; overdueWos: number }[];
  nextMilestone: { name: string; dueDate: Date; daysLeft: number } | null;
  openMilestones: number;
  completedMilestones: number;
};

const DAY = 86400000;

/**
 * P29 — Program health: milestone risk computed from the slippage of the work
 * orders linked to each project. A project is HIGH risk when any linked WO is
 * overdue (its planned end date has passed and it isn't COMPLETED) or any open
 * milestone has slipped; MEDIUM when WOs or milestones are due within 14 days.
 */
export async function computeProgramHealth(
  now: Date = new Date(),
): Promise<ProgramHealth[]> {
  const projects = await prisma.project.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    include: {
      milestones: { orderBy: { dueDate: "asc" } },
      workOrders: {
        select: { woNumber: true, plannedEndDate: true, status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return projects.map((p) => {
    const openWos = p.workOrders.filter((w) => w.status !== "COMPLETED");
    const overdueWos = openWos
      .filter((w) => new Date(w.plannedEndDate) < now)
      .map((w) => ({
        woNumber: w.woNumber,
        plannedEndDate: w.plannedEndDate,
        status: w.status,
      }));
    const dueSoonWos = openWos
      .filter((w) => {
        const d = new Date(w.plannedEndDate);
        return d >= now && d.getTime() - now.getTime() <= 14 * DAY;
      })
      .map((w) => ({
        woNumber: w.woNumber,
        plannedEndDate: w.plannedEndDate,
        status: w.status,
      }));

    const openMilestones = p.milestones.filter((m) => m.status !== "COMPLETED");
    const completedMilestones = p.milestones.length - openMilestones.length;

    // A milestone has slipped when linked WOs due before it are overdue
    const slippedMilestones = openMilestones
      .map((m) => {
        const dueBeforeMilestone = openWos.filter(
          (w) => new Date(w.plannedEndDate) <= new Date(m.dueDate),
        );
        const slipped = dueBeforeMilestone.filter(
          (w) => new Date(w.plannedEndDate) < now,
        );
        return { m, slipped };
      })
      .filter(({ slipped }) => slipped.length > 0)
      .map(({ m, slipped }) => ({
        name: m.name,
        dueDate: m.dueDate,
        overdueWos: slipped.length,
      }));

    const targetOverdue =
      new Date(p.targetCompletionDate) < now && openWos.length > 0;

    let risk: ProgramRisk = "LOW";
    if (
      overdueWos.length > 0 ||
      slippedMilestones.length > 0 ||
      targetOverdue
    ) {
      risk = "HIGH";
    } else if (
      dueSoonWos.length > 0 ||
      openMilestones.some(
        (m) => new Date(m.dueDate).getTime() - now.getTime() <= 14 * DAY,
      ) ||
      new Date(p.targetCompletionDate).getTime() - now.getTime() <= 30 * DAY
    ) {
      risk = "MEDIUM";
    }

    const nextMilestone = openMilestones.length
      ? {
          name: openMilestones[0].name,
          dueDate: openMilestones[0].dueDate,
          daysLeft: Math.max(
            0,
            Math.round(
              (new Date(openMilestones[0].dueDate).getTime() - now.getTime()) /
                DAY,
            ),
          ),
        }
      : null;

    return {
      projectId: p.id,
      code: p.code,
      name: p.name,
      clientName: p.clientName,
      status: p.status,
      salesOwner: p.salesOwner,
      targetCompletionDate: p.targetCompletionDate,
      risk,
      overdueWos,
      dueSoonWos,
      slippedMilestones,
      nextMilestone,
      openMilestones: openMilestones.length,
      completedMilestones,
    };
  });
}

export function classifyProjectRisk(
  p: any,
  now: Date = new Date(),
): ProgramRisk {
  const openWos = (p.workOrders || []).filter(
    (w: any) => w.status !== "COMPLETED",
  );
  const hasOverdue = openWos.some((w: any) => new Date(w.plannedEndDate) < now);
  const hasDueSoon = openWos.some((w: any) => {
    const d = new Date(w.plannedEndDate);
    return d >= now && d.getTime() - now.getTime() <= 14 * DAY;
  });
  const targetOverdue =
    new Date(p.targetCompletionDate) < now && openWos.length > 0;
  if (hasOverdue || targetOverdue) return "HIGH";
  if (hasDueSoon) return "MEDIUM";
  return "LOW";
}
