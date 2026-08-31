/**
 * Customer & Vendor Quality Complaint SLA Engine
 * Standardized on AS9100 / IATF 16949 SLA milestones:
 * - 24-hour formal customer acknowledgement
 * - 10-day 8D CAPA containment & root-cause closure
 */

export interface ComplaintLike {
  id?: string;
  complaintNumber?: string;
  title?: string;
  plantId?: string | null;
  status?: string | null;
  ackDeadline?: Date | string | null;
  ackAt?: Date | string | null;
  eightDDeadline?: Date | string | null;
  eightDClosedAt?: Date | string | null;
  createdAt?: Date | string | null;
  [key: string]: any;
}

export interface ComplaintSla {
  ackDeadline: Date | null;
  ackAt: Date | null;
  eightDDeadline: Date | null;
  eightDClosedAt: Date | null;
  ackBreached: boolean;
  eightDBreached: boolean;
  ackDueInHours: number | null; // Hours remaining (negative = overdue)
  eightDDueInDays: number | null; // Days remaining (negative = overdue)
  ackDueIn: number | null; // Legacy backward-compatibility alias
  eightDDueIn: number | null; // Legacy backward-compatibility alias
  isCompliant: boolean;
  slaStatus: "OK" | "WARNING_ACK" | "WARNING_8D" | "BREACHED_ACK" | "BREACHED_8D";
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Computes precision SLA adherence for quality complaints.
 * Supports configurable grace hours/days buffer.
 */
export function computeComplaintSla(
  complaint: ComplaintLike,
  now: Date = new Date(),
  graceBufferHours = 0,
): ComplaintSla {
  const safeNowMs = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();

  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const ackDeadline = parseDate(complaint.ackDeadline);
  const ackAt = parseDate(complaint.ackAt);
  const eightDDeadline = parseDate(complaint.eightDDeadline);
  const eightDClosedAt = parseDate(complaint.eightDClosedAt);

  const safeGraceHours = Math.max(0, Number(graceBufferHours) || 0);
  const graceMs = safeGraceHours * HOUR_MS;

  const ackBreached =
    !!ackDeadline &&
    !ackAt &&
    safeNowMs > ackDeadline.getTime() + graceMs;

  const eightDBreached =
    !!eightDDeadline &&
    !eightDClosedAt &&
    safeNowMs > eightDDeadline.getTime() + graceMs;

  const ackDueInHours = ackDeadline
    ? Math.round((ackDeadline.getTime() - safeNowMs) / HOUR_MS)
    : null;

  const eightDDueInDays = eightDDeadline
    ? Math.round((eightDDeadline.getTime() - safeNowMs) / DAY_MS)
    : null;

  let slaStatus: ComplaintSla["slaStatus"] = "OK";
  if (ackBreached) {
    slaStatus = "BREACHED_ACK";
  } else if (eightDBreached) {
    slaStatus = "BREACHED_8D";
  } else if (ackDueInHours !== null && ackDueInHours <= 4 && !ackAt) {
    slaStatus = "WARNING_ACK";
  } else if (eightDDueInDays !== null && eightDDueInDays <= 2 && !eightDClosedAt) {
    slaStatus = "WARNING_8D";
  }

  return {
    ackDeadline,
    ackAt,
    eightDDeadline,
    eightDClosedAt,
    ackBreached,
    eightDBreached,
    ackDueInHours,
    eightDDueInDays,
    ackDueIn: ackDueInHours,
    eightDDueIn: eightDDueInDays,
    isCompliant: !ackBreached && !eightDBreached,
    slaStatus,
  };
}

/**
 * Filters open complaints that have breached their acknowledgment or 8D closure SLA.
 */
export function breachedComplaints<T extends ComplaintLike>(
  complaints: T[] = [],
  now: Date = new Date(),
): (T & { sla: ComplaintSla })[] {
  if (!Array.isArray(complaints)) return [];

  return complaints
    .map((c) => ({
      ...c,
      sla: computeComplaintSla(c, now),
    }))
    .filter((c) => c.sla.ackBreached || c.sla.eightDBreached);
}
