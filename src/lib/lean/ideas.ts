/**
 * C9-4 — Idea pipeline (DEPTH_03 F11): SUBMITTED → IN_REVIEW → IMPLEMENTED,
 * each step only from its source status; upvotes are additive and never
 * touch status. Terminal IMPLEMENTED refuses further transitions.
 */

import { ok, err, type Result } from "../core/result";

export type IdeaStatus = "SUBMITTED" | "IN_REVIEW" | "IMPLEMENTED";
export type IdeaAction = "START_REVIEW" | "IMPLEMENT";

export interface IdeaInput {
  id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
}

export interface IdeaDraftInput {
  title: string;
  description: string;
}

export interface IdeaDraft {
  title: string;
  description: string;
  status: "SUBMITTED";
  votes: number;
}

export type IdeaError = "TITLE_REQUIRED" | "DESCRIPTION_REQUIRED" | "INVALID_STATUS" | "UNKNOWN_ACTION";

const blank = (s: string | null | undefined): boolean => !s || s.trim().length === 0;

export function validateIdeaDraft(draft: IdeaDraftInput): Result<IdeaDraft, IdeaError> {
  if (blank(draft.title)) return err("TITLE_REQUIRED");
  if (blank(draft.description)) return err("DESCRIPTION_REQUIRED");
  return ok({
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: "SUBMITTED",
    votes: 0,
  });
}

export function transitionIdea(
  idea: IdeaInput,
  action: IdeaAction,
  _actor: string,
  _now: Date,
): Result<IdeaInput, IdeaError> {
  if (action === "START_REVIEW") {
    if (idea.status !== "SUBMITTED") return err("INVALID_STATUS");
    return ok({ ...idea, status: "IN_REVIEW" });
  }
  if (action === "IMPLEMENT") {
    if (idea.status !== "IN_REVIEW") return err("INVALID_STATUS");
    return ok({ ...idea, status: "IMPLEMENTED" });
  }
  return err("UNKNOWN_ACTION");
}

/** Additive vote; status and all other fields untouched. */
export function upvoteIdea(idea: IdeaInput): IdeaInput {
  return { ...idea, votes: idea.votes + 1 };
}