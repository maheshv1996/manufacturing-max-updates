/**
 * C9-2 — Improvement project machine (DEPTH_03 F11 guardrails).
 * • DMAIC phases advance strictly sequentially DEFINE→MEASURE→ANALYZE→IMPROVE→
 *   CONTROL; any advance pulls an OPEN project into IN_PROGRESS.
 * • Status: OPEN→IN_PROGRESS→ON_HOLD→IN_PROGRESS reversible; COMPLETED is
 *   reachable ONLY through completeProject, which demands completion evidence —
 *   RCA rootCause present AND every action item DONE — and stamps completedAt.
 *   (F11: no completion without evidence, mirroring v1 parity.)
 */

import { ok, err, type Result } from "../core/result";

// ------------------------------------------------------------------ types

export const PROJECT_TYPES = ["KAIZEN", "DMAIC"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_PHASES = ["DEFINE", "MEASURE", "ANALYZE", "IMPROVE", "CONTROL"] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export type ProjectStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
export type ActionItemStatus = "OPEN" | "DONE";

export interface ProjectInput {
  id: string;
  title: string;
  type: string;
  phase: string;
  status: string;
  ownerName: string;
  completedAt: Date | null;
}

export interface ActionItemInput {
  id: string;
  description: string;
  ownerName: string;
  dueDate: Date;
  status: string;
}

export interface ProjectDraftInput {
  title: string;
  ownerName: string;
  type: string;
}

export interface ProjectDraft {
  title: string;
  type: ProjectType;
  phase: "DEFINE";
  status: "OPEN";
  ownerName: string;
  completedAt: null;
}

export interface ActionItemDraftInput {
  description: string;
  ownerName: string;
  dueDate: Date;
}

export interface ActionItemDraft {
  description: string;
  ownerName: string;
  dueDate: Date;
  status: "OPEN";
}

export type ProjectError =
  | "TITLE_REQUIRED"
  | "OWNER_REQUIRED"
  | "INVALID_TYPE"
  | "DESCRIPTION_REQUIRED"
  | "DUE_DATE_REQUIRED"
  | "INVALID_PHASE"
  | "AT_CONTROL"
  | "ON_HOLD"
  | "COMPLETED"
  | "INVALID_STATUS"
  | "COMPLETION_EVIDENCE_REQUIRED"
  | "ALREADY_DONE";

export type CompletionEvidenceCode = "RCA_ROOT_CAUSE" | "ACTION_ITEMS_OPEN";

const blank = (s: string | null | undefined): boolean => !s || s.trim().length === 0;

// ------------------------------------------------------------- draft gates

export function validateProjectDraft(draft: ProjectDraftInput): Result<ProjectDraft, ProjectError> {
  if (blank(draft.title)) return err("TITLE_REQUIRED");
  if (blank(draft.ownerName)) return err("OWNER_REQUIRED");
  if (!(PROJECT_TYPES as readonly string[]).includes(draft.type)) return err("INVALID_TYPE");
  return ok({
    title: draft.title.trim(),
    type: draft.type as ProjectType,
    phase: "DEFINE",
    status: "OPEN",
    ownerName: draft.ownerName.trim(),
    completedAt: null,
  });
}

export function validateActionItem(
  draft: ActionItemDraftInput,
): Result<ActionItemDraft, ProjectError> {
  if (blank(draft.description)) return err("DESCRIPTION_REQUIRED");
  if (blank(draft.ownerName)) return err("OWNER_REQUIRED");
  if (!(draft.dueDate instanceof Date) || Number.isNaN(draft.dueDate.getTime())) {
    return err("DUE_DATE_REQUIRED");
  }
  return ok({
    description: draft.description.trim(),
    ownerName: draft.ownerName.trim(),
    dueDate: draft.dueDate,
    status: "OPEN",
  });
}

// -------------------------------------------------------- phase & status

export function advancePhase(p: ProjectInput): Result<ProjectInput, ProjectError> {
  if (p.status === "ON_HOLD") return err("ON_HOLD");
  if (p.status === "COMPLETED") return err("COMPLETED");
  const idx = (PROJECT_PHASES as readonly string[]).indexOf(p.phase);
  if (idx === -1) return err("INVALID_PHASE");
  const next = PROJECT_PHASES[idx + 1];
  if (!next) return err("AT_CONTROL");
  return ok({
    ...p,
    phase: next,
    status: p.status === "OPEN" ? "IN_PROGRESS" : p.status,
  });
}

/** Hold/resume moves — COMPLETED is deliberately unreachable here. */
export function setStatus(
  p: ProjectInput,
  next: string,
): Result<ProjectInput, ProjectError> {
  if (p.status === "COMPLETED") return err("COMPLETED");
  if (next !== "IN_PROGRESS" && next !== "ON_HOLD") return err("INVALID_STATUS");
  if (next === p.status) return err("INVALID_STATUS");
  return ok({ ...p, status: next });
}

// ------------------------------------------------------ completion (F11)

export function completionEvidence(
  _p: ProjectInput,
  rca: { rootCause: string | null },
  items: ActionItemInput[],
): { ok: boolean; missing: CompletionEvidenceCode[] } {
  const missing: CompletionEvidenceCode[] = [];
  if (blank(rca.rootCause)) missing.push("RCA_ROOT_CAUSE");
  if (items.some((i) => i.status !== "DONE")) missing.push("ACTION_ITEMS_OPEN");
  return { ok: missing.length === 0, missing };
}

export function completeProject(
  p: ProjectInput,
  rca: { rootCause: string | null },
  items: ActionItemInput[],
  _actor: string,
  now: Date,
): Result<ProjectInput, ProjectError> {
  if (p.status === "COMPLETED") return err("COMPLETED");
  const evidence = completionEvidence(p, rca, items);
  if (!evidence.ok) return err("COMPLETION_EVIDENCE_REQUIRED");
  return ok({ ...p, status: "COMPLETED", completedAt: now });
}

// ------------------------------------------------------------ action items

export function markItemDone(item: ActionItemInput): Result<ActionItemInput, ProjectError> {
  if (item.status === "DONE") return err("ALREADY_DONE");
  return ok({ ...item, status: "DONE" });
}