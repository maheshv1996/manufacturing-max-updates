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
 * milestone has slipped; MEDIUM when WOs or milestones are due within dueSoonDays.
 */
export async function computeProgramHealth(
  now: Date = new Date(),
  dueSoonDays: number = 14,
  mediumRiskDays: number = 30,
): Promise<ProgramHealth[]> {
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const dueSoonMs = Math.max(1, dueSoonDays) * DAY;
  const mediumRiskMs = Math.max(1, mediumRiskDays) * DAY;

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
      .filter((w) => {
        const d = new Date(w.plannedEndDate);
        return !isNaN(d.getTime()) && d < safeNow;
      })
      .map((w) => ({
        woNumber: w.woNumber,
        plannedEndDate: w.plannedEndDate,
        status: w.status,
      }));
    const dueSoonWos = openWos
      .filter((w) => {
        const d = new Date(w.plannedEndDate);
        return !isNaN(d.getTime()) && d >= safeNow && d.getTime() - safeNow.getTime() <= dueSoonMs;
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
        const milestoneDate = new Date(m.dueDate);
        const dueBeforeMilestone = openWos.filter((w) => {
          const wd = new Date(w.plannedEndDate);
          return !isNaN(wd.getTime()) && !isNaN(milestoneDate.getTime()) && wd <= milestoneDate;
        });
        const slipped = dueBeforeMilestone.filter((w) => {
          const wd = new Date(w.plannedEndDate);
          return wd < safeNow;
        });
        return { m, slipped };
      })
      .filter(({ slipped }) => slipped.length > 0)
      .map(({ m, slipped }) => ({
        name: m.name,
        dueDate: m.dueDate,
        overdueWos: slipped.length,
      }));

    const targetDate = new Date(p.targetCompletionDate);
    const targetOverdue =
      !isNaN(targetDate.getTime()) && targetDate < safeNow && openWos.length > 0;

    let risk: ProgramRisk = "LOW";
    if (
      overdueWos.length > 0 ||
      slippedMilestones.length > 0 ||
      targetOverdue
    ) {
      risk = "HIGH";
    } else if (
      dueSoonWos.length > 0 ||
      openMilestones.some((m) => {
        const md = new Date(m.dueDate);
        return !isNaN(md.getTime()) && md.getTime() - safeNow.getTime() <= dueSoonMs;
      }) ||
      (!isNaN(targetDate.getTime()) && targetDate.getTime() - safeNow.getTime() <= mediumRiskMs)
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
              (new Date(openMilestones[0].dueDate).getTime() - safeNow.getTime()) /
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
  dueSoonDays: number = 14,
): ProgramRisk {
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const dueSoonMs = Math.max(1, dueSoonDays) * DAY;
  const openWos = (p.workOrders || []).filter(
    (w: any) => w.status !== "COMPLETED",
  );
  const hasOverdue = openWos.some((w: any) => {
    const d = new Date(w.plannedEndDate);
    return !isNaN(d.getTime()) && d < safeNow;
  });
  const hasDueSoon = openWos.some((w: any) => {
    const d = new Date(w.plannedEndDate);
    return !isNaN(d.getTime()) && d >= safeNow && d.getTime() - safeNow.getTime() <= dueSoonMs;
  });
  const targetDate = new Date(p.targetCompletionDate);
  const targetOverdue =
    !isNaN(targetDate.getTime()) && targetDate < safeNow && openWos.length > 0;
  if (hasOverdue || targetOverdue) return "HIGH";
  if (hasDueSoon) return "MEDIUM";
  return "LOW";
}
