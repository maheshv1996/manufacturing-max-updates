/**
 * C3-5 — Pure complaint SLA core (DEPTH_04 W5). Ack deadline 24h from
 * receipt; 8D deadline 10 days from receipt (v1 semantics: the 8D timer runs
 * from createdAt — ackAt only stamps the acknowledgement). PENDING until the
 * window passes, then OVERDUE; ack recorded in time is OK.
 */
export const ACK_WINDOW_MS = 24 * 60 * 60 * 1000;
export const EIGHT_D_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

export type SlaState = "PENDING" | "OK" | "OVERDUE";

export interface ComplaintSla {
  ack: SlaState;
  eightD: SlaState;
  ackDeadline: Date;
  eightDDeadline: Date;
}

export function slaStatus(createdAt: Date, ackAt: Date | null, now: Date): ComplaintSla {
  const ackDeadline = new Date(createdAt.getTime() + ACK_WINDOW_MS);
  const eightDDeadline = new Date(createdAt.getTime() + EIGHT_D_WINDOW_MS);

  let ack: SlaState;
  if (ackAt) {
    ack = ackAt.getTime() <= ackDeadline.getTime() ? "OK" : "OVERDUE";
  } else {
    ack = now.getTime() > ackDeadline.getTime() ? "OVERDUE" : "PENDING";
  }

  const eightD: SlaState = now.getTime() > eightDDeadline.getTime() ? "OVERDUE" : "PENDING";

  return { ack, eightD, ackDeadline, eightDDeadline };
}