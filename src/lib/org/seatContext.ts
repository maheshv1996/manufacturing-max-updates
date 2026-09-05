/**
 * C1 — Seat context assembler (DEPTH_02 §10). Pure mapping from DB-shaped
 * rows (RoleAssignment + role) + the Level ladder into the SeatResolution the
 * resolver computes, plus role codes and the covered (actsFor) seat for AI
 * + RBAC consumers. The DB adapter (loadSeatContext) maps Prisma rows into
 * AssignmentRowContext and calls this.
 */
import { resolveSeats, type SeatStatus, type Scope, type SeatResolution } from "./seat";
import { isPermissionKey, type PermissionKey } from "./permissions";

export interface AssignmentRowContext {
  id: string;
  roleId: string;
  levelName: string;
  scope: string;
  status: string;
  validFrom: Date | string;
  validTo?: Date | string | null;
  actsForUserId?: string | null;
  role?: { id: string; name: string; permissions: string[] } | null;
}

export interface LevelRef {
  name: string;
  rank: number;
}

export interface SeatContext extends SeatResolution {
  /** Unique role display names across active seats (order preserved). */
  roleCodes: string[];
  /** Covered user id when any active seat is ACTING, else null. */
  actsForUserId: string | null;
}

export function assembleSeatContext(
  rows: readonly AssignmentRowContext[],
  levels: readonly LevelRef[],
  now: Date,
): SeatContext {
  const ladder = new Map(levels.map((l) => [l.name, l.rank]));

  // Unknown level name => the assignment cannot resolve a rank => drop it.
  const known = rows.filter((r) => ladder.has(r.levelName));

  const resolution = resolveSeats(
    known.map((r) => ({
      id: r.id,
      roleId: r.roleId,
      rolePermissions: (r.role?.permissions ?? []).filter(
        (p): p is PermissionKey => isPermissionKey(p),
      ),
      levelName: r.levelName,
      levelRank: ladder.get(r.levelName) ?? 0,
      scope: (r.scope ?? "SELF") as Scope,
      validFrom: r.validFrom,
      validTo: r.validTo ?? null,
      status: (r.status ?? "ACTIVE") as SeatStatus,
      actsForUserId: r.actsForUserId ?? null,
    })),
    now,
  );

  const roleCodes = [
    ...new Set(
      known
        .map((r) => r.role?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  const actsForUserId =
    resolution.seats.find((s) => s.actsForUserId)?.actsForUserId ?? null;

  return { ...resolution, roleCodes, actsForUserId };
}
