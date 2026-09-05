import { err, ok, type Result } from "../core/result";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveAction = "APPROVE" | "REJECT" | "CANCEL";

export interface LeaveInput {
  userId: string;
  type: "CL" | "SL" | "PL";
  fromDate: Date;
  toDate: Date;
  reason: string;
}

export interface LeaveRecord extends LeaveInput {
  id: string;
  status: LeaveStatus;
  approvedById?: string;
  approvedAt?: Date;
  note?: string;
  createdAt: Date;
}

export type TransitionResult = {
  status: LeaveStatus;
  approvedById?: string;
  approvedAt?: Date;
  note?: string;
};

export function transitionLeave(
  current: LeaveStatus,
  action: LeaveAction,
  reason?: string,
): Result<TransitionResult, string> {
  if (action === "APPROVE") {
    if (current !== "PENDING") return err("ILLEGAL_TRANSITION");
    return ok({ status: "APPROVED", approvedAt: new Date(), note: reason });
  }

  if (action === "REJECT") {
    if (current !== "PENDING") return err("ILLEGAL_TRANSITION");
    if (!reason || reason.trim().length === 0) return err("REASON_REQUIRED");
    return ok({ status: "REJECTED", note: reason.trim() });
  }

  if (action === "CANCEL") {
    if (current !== "PENDING") return err("ILLEGAL_TRANSITION");
    return ok({ status: "CANCELLED" });
  }

  return err("ILLEGAL_TRANSITION");
}

export function nextLeaveNumber(date: Date): string {
  const y = date.getFullYear();
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `LV-${y}-${seq}`;
}
