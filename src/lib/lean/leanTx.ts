/**
 * C9-5 — Typed lean/CI transaction adapters (F11 guardrails).
 * Improvement projects (DMAIC machine), action items, 5S audits and the idea
 * pipeline. Pure engine first, then one $transaction write with in-tx audit.
 */

import type {
  PrismaClient,
  Prisma,
  ProjectType,
  ProjectPhase,
  ProjectStatus,
  FishboneCategory,
} from "@prisma/client";
import { notFound, validation } from "../core/errors";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import {
  validateProjectDraft,
  advancePhase,
  setStatus,
  completeProject,
  validateActionItem,
  markItemDone,
  type ProjectDraftInput,
  type ProjectInput,
  type ActionItemDraftInput,
  type ProjectError,
} from "./projects";
import { computeFiveSPct } from "./fiveS";
import {
  validateIdeaDraft,
  transitionIdea,
  upvoteIdea,
  type IdeaDraftInput,
  type IdeaAction,
} from "./ideas";
import type { Result } from "../core/result";

type Tx = Prisma.TransactionClient;

async function audit(tx: Tx, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

export interface LeanActor {
  id: string;
  name?: string;
}

function engineError(code: string): never {
  throw validation(code);
}

// ---------------------------------------------------------------- projects

export async function createProjectTx(
  db: PrismaClient,
  actor: LeanActor,
  draft: ProjectDraftInput & { description?: string | null; machineId?: string | null },
): Promise<{ id: string; status: string; phase: string }> {
  const checked = validateProjectDraft(draft);
  if (checked.tag === "err") engineError(checked.error);
  const v = checked.value;

  return db.$transaction(async (tx) => {
    const row = await tx.improvementProject.create({
      data: {
        title: v.title,
        description: draft.description ?? null,
        type: v.type as ProjectType,
        phase: v.phase as ProjectPhase,
        status: v.status as ProjectStatus,
        ownerName: v.ownerName,
        machineId: draft.machineId ?? null,
      },
      select: { id: true, status: true, phase: true },
    });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "ImprovementProject",
      entityId: row.id,
      action: "CREATE",
      details: `${v.type} project "${v.title}" opened (DEFINE)`,
    });
    return row;
  });
}

export type ProjectAction = "ADVANCE_PHASE" | "HOLD" | "RESUME" | "COMPLETE";

export async function projectActionTx(
  db: PrismaClient,
  actor: LeanActor,
  projectId: string,
  action: ProjectAction,
): Promise<{ id: string; status: string; phase: string }> {
  return db.$transaction(async (tx) => {
    const p = await tx.improvementProject.findUnique({
      where: { id: projectId },
      include: {
        rcaRecord: { select: { rootCause: true } },
        actionItems: { select: { id: true, status: true } },
      },
    });
    if (!p) throw notFound("Improvement project not found");

    const input: ProjectInput = {
      id: p.id,
      title: p.title,
      type: p.type,
      phase: p.phase,
      status: p.status,
      ownerName: p.ownerName,
      completedAt: p.completedAt,
    };
    let result: Result<ProjectInput, ProjectError>;
    let details: string;

    if (action === "ADVANCE_PHASE") {
      const r = advancePhase(input);
      details = `Phase → ${r.tag === "ok" ? r.value.phase : "INVALID"}`;
      result = r;
    } else if (action === "HOLD") {
      const r = setStatus(input, "ON_HOLD");
      details = "Project → ON_HOLD";
      result = r;
    } else if (action === "RESUME") {
      const r = setStatus(input, "IN_PROGRESS");
      details = "Project → IN_PROGRESS";
      result = r;
    } else {
      const r = completeProject(
        input,
        { rootCause: p.rcaRecord?.rootCause ?? null },
        p.actionItems.map((i) => ({
          id: i.id,
          description: "",
          ownerName: "",
          dueDate: new Date(),
          status: i.status,
        })),
        actor.name ?? actor.id,
        new Date(),
      );
      details = r.tag === "ok" ? "Project COMPLETED (evidence verified)" : "Completion evidence missing";
      result = r;
    }
    if (result.tag === "err") engineError(result.error);
    const v = result.value;

    const updated = await tx.improvementProject.update({
      where: { id: projectId },
      data: {
        phase: v.phase as ProjectPhase,
        status: v.status as ProjectStatus,
        completedAt: v.completedAt,
      },
      select: { id: true, status: true, phase: true },
    });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "ImprovementProject",
      entityId: projectId,
      action,
      details,
    });
    return updated;
  });
}

// ------------------------------------------------------------- RCA & Actions

export async function recordRcaTx(
  db: PrismaClient,
  actor: LeanActor,
  projectId: string,
  rca: {
    problemStatement?: string | null;
    why1?: string | null;
    why2?: string | null;
    why3?: string | null;
    why4?: string | null;
    why5?: string | null;
    rootCause?: string | null;
    fishboneCategory?: FishboneCategory | null;
  },
): Promise<{ id: string; projectId: string; rootCause: string | null }> {
  return db.$transaction(async (tx) => {
    const project = await tx.improvementProject.findUnique({ where: { id: projectId } });
    if (!project) throw notFound("Improvement project not found");

    const row = await tx.rcaRecord.upsert({
      where: { projectId },
      create: {
        projectId,
        problemStatement: rca.problemStatement ?? null,
        why1: rca.why1 ?? null,
        why2: rca.why2 ?? null,
        why3: rca.why3 ?? null,
        why4: rca.why4 ?? null,
        why5: rca.why5 ?? null,
        rootCause: rca.rootCause ?? null,
        fishboneCategory: rca.fishboneCategory ?? null,
      },
      update: {
        problemStatement: rca.problemStatement ?? undefined,
        why1: rca.why1 ?? undefined,
        why2: rca.why2 ?? undefined,
        why3: rca.why3 ?? undefined,
        why4: rca.why4 ?? undefined,
        why5: rca.why5 ?? undefined,
        rootCause: rca.rootCause ?? undefined,
        fishboneCategory: rca.fishboneCategory ?? undefined,
      },
      select: { id: true, projectId: true, rootCause: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "ImprovementProject",
      entityId: projectId,
      action: "RCA_RECORDED",
      details: `RCA updated${rca.rootCause ? `: ${rca.rootCause}` : ""}`,
    });

    return row;
  });
}

export async function addActionItemTx(
  db: PrismaClient,
  actor: LeanActor,
  projectId: string,
  draft: ActionItemDraftInput,
): Promise<{ id: string; description: string; status: string }> {
  const checked = validateActionItem(draft);
  if (checked.tag === "err") engineError(checked.error);
  const v = checked.value;

  return db.$transaction(async (tx) => {
    const project = await tx.improvementProject.findUnique({ where: { id: projectId } });
    if (!project) throw notFound("Improvement project not found");

    const item = await tx.actionItem.create({
      data: {
        projectId,
        description: v.description,
        ownerName: v.ownerName,
        dueDate: v.dueDate,
        status: v.status,
      },
      select: { id: true, description: true, status: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "ImprovementProject",
      entityId: projectId,
      action: "ACTION_ITEM_ADDED",
      details: `Action item: ${v.description} (${v.ownerName})`,
    });

    return item;
  });
}

export async function markActionItemDoneTx(
  db: PrismaClient,
  actor: LeanActor,
  itemId: string,
): Promise<{ id: string; status: string }> {
  return db.$transaction(async (tx) => {
    const item = await tx.actionItem.findUnique({ where: { id: itemId } });
    if (!item) throw notFound("Action item not found");

    const checked = markItemDone({
      id: item.id,
      description: item.description,
      ownerName: item.ownerName,
      dueDate: item.dueDate,
      status: item.status,
    });
    if (checked.tag === "err") engineError(checked.error);

    const updated = await tx.actionItem.update({
      where: { id: itemId },
      data: { status: "DONE" },
      select: { id: true, status: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "ImprovementProject",
      entityId: item.projectId,
      action: "ACTION_ITEM_DONE",
      details: `Action item marked DONE: ${item.description}`,
    });

    return updated;
  });
}

// ---------------------------------------------------------------- 5S Audit

export async function recordFiveSAuditTx(
  db: PrismaClient,
  actor: LeanActor,
  data: {
    area: string;
    auditorName: string;
    notes?: string | null;
    scores: { itemId: string; score: number }[];
  },
): Promise<{ id: string; totalPct: number; scoreCount: number }> {
  const pctResult = computeFiveSPct(data.scores.map((s) => s.score));
  if (pctResult.tag === "err") engineError(pctResult.error);
  const totalPct = pctResult.value;

  return db.$transaction(async (tx) => {
    const auditRow = await tx.fiveSAudit.create({
      data: {
        area: data.area.trim(),
        auditorName: data.auditorName.trim(),
        totalPct,
        notes: data.notes ?? null,
      },
      select: { id: true, totalPct: true },
    });

    if (data.scores.length > 0) {
      await tx.fiveSAuditScore.createMany({
        data: data.scores.map((s) => ({
          auditId: auditRow.id,
          itemId: s.itemId,
          score: s.score,
        })),
      });
    }

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "FiveSAudit",
      entityId: auditRow.id,
      action: "CREATE",
      details: `5S audit in ${data.area}: ${totalPct}% (${data.scores.length} items)`,
    });

    return { id: auditRow.id, totalPct: auditRow.totalPct, scoreCount: data.scores.length };
  });
}

// ------------------------------------------------------------------ Ideas

export async function submitIdeaTx(
  db: PrismaClient,
  actor: LeanActor,
  draft: IdeaDraftInput & { category?: string | null },
): Promise<{ id: string; status: string; votes: number }> {
  const checked = validateIdeaDraft(draft);
  if (checked.tag === "err") engineError(checked.error);
  const v = checked.value;

  return db.$transaction(async (tx) => {
    const row = await tx.idea.create({
      data: {
        title: v.title,
        description: v.description,
        category: draft.category?.trim() || "SAFETY",
        submitter: actor.name ?? "Operator",
        submittedBy: actor.name ?? actor.id,
        status: v.status,
        votes: v.votes,
      },
      select: { id: true, status: true, votes: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "Idea",
      entityId: row.id,
      action: "CREATE",
      details: `Idea submitted: "${v.title}" (${draft.category ?? "SAFETY"})`,
    });

    return row;
  });
}

export async function upvoteIdeaTx(
  db: PrismaClient,
  actor: LeanActor,
  ideaId: string,
): Promise<{ id: string; votes: number }> {
  return db.$transaction(async (tx) => {
    const idea = await tx.idea.findUnique({ where: { id: ideaId } });
    if (!idea) throw notFound("Idea not found");

    const updated = upvoteIdea({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      status: idea.status,
      votes: idea.votes,
    });

    const row = await tx.idea.update({
      where: { id: ideaId },
      data: { votes: updated.votes },
      select: { id: true, votes: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "Idea",
      entityId: ideaId,
      action: "UPVOTE",
      details: `Idea upvoted to ${row.votes}`,
    });

    return row;
  });
}

export async function transitionIdeaTx(
  db: PrismaClient,
  actor: LeanActor,
  ideaId: string,
  action: IdeaAction,
): Promise<{ id: string; status: string }> {
  return db.$transaction(async (tx) => {
    const idea = await tx.idea.findUnique({ where: { id: ideaId } });
    if (!idea) throw notFound("Idea not found");

    const result = transitionIdea(
      {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        status: idea.status,
        votes: idea.votes,
      },
      action,
      actor.name ?? actor.id,
      new Date(),
    );
    if (result.tag === "err") engineError(result.error);
    const v = result.value;

    const row = await tx.idea.update({
      where: { id: ideaId },
      data: { status: v.status },
      select: { id: true, status: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "Idea",
      entityId: ideaId,
      action,
      details: `Idea status → ${v.status}`,
    });

    return row;
  });
}
