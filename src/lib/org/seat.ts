/**
 * C1-6 — Seat resolver (DEPTH_02 §3, §10). Pure & DB-free: callers resolve
 * RoleAssignment rows + Level ranks into RawAssignment objects; this module
 * computes effective seats/permissions/level/scope. No Prisma import.
 */
import type { PermissionKey } from "./permissions";

export type SeatStatus = "ACTIVE" | "ACTING" | "SUSPENDED" | "EXITED";
export type Scope = "SELF" | "TEAM" | "UNIT" | "PLANT" | "ALL";

export const SCOPE_ORDER: Record<Scope, number> = {
  SELF: 0,
  TEAM: 1,
  UNIT: 2,
  PLANT: 3,
  ALL: 4,
};

export interface RawAssignment {
  id: string;
  roleId: string;
  rolePermissions: readonly PermissionKey[];
  levelName: string;
  levelRank: number;
  scope: Scope;
  validFrom: Date | string;
  validTo?: Date | string | null;
  status: SeatStatus;
  actsForUserId?: string | null;
}

export interface Seat {
  id: string;
  roleId: string;
  levelName: string;
  levelRank: number;
  scope: Scope;
  status: SeatStatus;
  actsForUserId?: string | null;
}

export interface SeatResolution {
  seats: Seat[];
  /** Union of permission keys across active seats. */
  perms: ReadonlySet<PermissionKey>;
  /** Highest level rank among active seats (grade-gating compares this). */
  maxLevelRank: number;
  homeSeat: Seat | null;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

export function resolveSeats(assignments: readonly RawAssignment[], now: Date): SeatResolution {
  const seats: Seat[] = [];
  const perms = new Set<PermissionKey>();
  let maxLevelRank = Number.NEGATIVE_INFINITY;

  for (const a of assignments) {
    if (a.status === "SUSPENDED" || a.status === "EXITED") continue;
    const from = toDate(a.validFrom);
    if (from > now) continue;
    const to = a.validTo ? toDate(a.validTo) : null;
    if (to && to < now) continue;

    seats.push({
      id: a.id,
      roleId: a.roleId,
      levelName: a.levelName,
      levelRank: a.levelRank,
      scope: a.scope,
      status: a.status,
      actsForUserId: a.actsForUserId ?? null,
    });
    for (const p of a.rolePermissions) perms.add(p);
    if (a.levelRank > maxLevelRank) maxLevelRank = a.levelRank;
  }

  return {
    seats,
    perms,
    maxLevelRank: maxLevelRank === Number.NEGATIVE_INFINITY ? 0 : maxLevelRank,
    homeSeat: seats.length > 0 ? seats[0] : null,
  };
}

/** Scope ladder: a grant satisfies any requirement at or below its breadth. */
export function scopeSatisfies(required: Scope, granted: Scope): boolean {
  return SCOPE_ORDER[granted] >= SCOPE_ORDER[required];
}
