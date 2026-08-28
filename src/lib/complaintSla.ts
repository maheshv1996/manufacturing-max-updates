// M8 — Complaint SLA: 24h acknowledgement, 10-day 8D closure.
export interface ComplaintSla {
  ackDeadline: Date | null;
  ackAt: Date | null;
  eightDDeadline: Date | null;
  eightDClosedAt: Date | null;
  ackBreached: boolean;
  eightDBreached: boolean;
  ackDueIn: number | null; // hours remaining (negative = overdue)
  eightDDueIn: number | null; // days remaining (negative = overdue)
}

export function computeComplaintSla(
  complaint: any,
  now: Date = new Date(),
): ComplaintSla {
  const ackDeadline = complaint.ackDeadline
    ? new Date(complaint.ackDeadline)
    : null;
  const ackAt = complaint.ackAt ? new Date(complaint.ackAt) : null;
  const eightDDeadline = complaint.eightDDeadline
    ? new Date(complaint.eightDDeadline)
    : null;
  const eightDClosedAt = complaint.eightDClosedAt
    ? new Date(complaint.eightDClosedAt)
    : null;

  const ackBreached =
    !!ackDeadline && !ackAt && now.getTime() > ackDeadline.getTime();
  const eightDBreached =
    !!eightDDeadline &&
    !eightDClosedAt &&
    now.getTime() > eightDDeadline.getTime();

  const ackDueIn = ackDeadline
    ? Math.round((ackDeadline.getTime() - now.getTime()) / 3600000)
    : null;
  const eightDDueIn = eightDDeadline
    ? Math.ceil((eightDDeadline.getTime() - now.getTime()) / 86400000)
    : null;

  return {
    ackDeadline,
    ackAt,
    eightDDeadline,
    eightDClosedAt,
    ackBreached,
    eightDBreached,
    ackDueIn,
    eightDDueIn,
  };
}

// Open complaints with a breached SLA (or nearing breach within the grace window)
export function breachedComplaints(
  complaints: any[],
  now: Date = new Date(),
): any[] {
  return complaints
    .map((c) => ({ ...c, sla: computeComplaintSla(c, now) }))
    .filter((c) => c.sla.ackBreached || c.sla.eightDBreached);
}
