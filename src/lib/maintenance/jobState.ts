/**
 * C8-1 — Maintenance job state machine (W11).
 * OPEN → IN_PROGRESS → CLOSED. Closure gates are the guardrail:
 * findings (laborHours) always; BREAKDOWN additionally needs rootCause,
 * and breakdowns running past 60 minutes additionally need a countermeasure (P28).
 * Pure — no DB.
 */

import { ok, err, type Result } from "../core/result";

export type MaintenanceJobType = "BREAKDOWN" | "PM";
export type MaintenanceJobStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export interface JobStateInput {
  id: string;
  machineId: string;
  type: MaintenanceJobType;
  priority: string;
  description: string;
  status: MaintenanceJobStatus;
  openedAt: Date;
  closedAt?: Date | null;
}

export type JobAction = { action: "START" } | { action: "CLOSE"; laborHours?: number; rootCause?: string; countermeasure?: string };

export interface JobStateOutput {
  status: MaintenanceJobStatus;
  closedAt?: Date;
  laborHours?: number;
  rootCause?: string;
  countermeasure?: string;
}

/** P28 — breakdowns longer than this demand a written countermeasure. */
export const BREAKDOWN_RCA_THRESHOLD_MIN = 60;

export function evaluateJobGuards(
  job: Pick<JobStateInput, "type">,
  openedAt: Date,
  now: Date,
): { countermeasureRequired: boolean } {
  const isLongBreakdown = job.type === "BREAKDOWN" && now.getTime() - openedAt.getTime() > BREAKDOWN_RCA_THRESHOLD_MIN * 60_000;
  return { countermeasureRequired: isLongBreakdown };
}

export function transitionJob(
  job: JobStateInput,
  a: JobAction,
): Result<JobStateOutput, "ILLEGAL_TRANSITION" | "FINDINGS_REQUIRED" | "ROOT_CAUSE_REQUIRED" | "COUNTERMEASURE_REQUIRED"> {
  switch (a.action) {
    case "START": {
      if (job.status !== "OPEN") return err("ILLEGAL_TRANSITION");
      return ok({ status: "IN_PROGRESS" });
    }
    case "CLOSE": {
      if (job.status !== "IN_PROGRESS") return err("ILLEGAL_TRANSITION");
      if (a.laborHours === undefined || a.laborHours === null || !Number.isFinite(a.laborHours) || a.laborHours <= 0) {
        return err("FINDINGS_REQUIRED");
      }
      if (job.type === "BREAKDOWN" && (!a.rootCause || a.rootCause.trim().length === 0)) {
        return err("ROOT_CAUSE_REQUIRED");
      }
      if (job.type === "BREAKDOWN" && evaluateJobGuards(job, job.openedAt, new Date()).countermeasureRequired) {
        if (!a.countermeasure || a.countermeasure.trim().length === 0) return err("COUNTERMEASURE_REQUIRED");
      }
      return ok({
        status: "CLOSED",
        closedAt: new Date(),
        laborHours: a.laborHours,
        rootCause: a.rootCause,
        countermeasure: a.countermeasure,
      });
    }
  }
}
