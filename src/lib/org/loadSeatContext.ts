/**
 * C1 — loadSeatContext: DB adapter that fetches a user's RoleAssignments
 * (with their Role permission bundles) + the Level ladder and produces the
 * typed SeatContext via the pure assembler. Route/service layer only — no UI
 * imports this.
 */
import type { PrismaClient } from "@prisma/client";
import {
  assembleSeatContext,
  type AssignmentRowContext,
  type SeatContext,
} from "./seatContext";

export interface SeatUserView {
  id: string;
  name: string | null;
  username: string | null;
  employeeNumber: string | null;
  homePlantId: string | null;
  isOwner: boolean;
}

export interface LoadedSeatContext {
  user: SeatUserView | null;
  context: SeatContext | null;
}

export async function loadSeatContext(
  db: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<LoadedSeatContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      employeeNumber: true,
      homePlantId: true,
      isOwner: true,
      isActive: true,
      roleAssignments: {
        include: {
          role: { select: { id: true, name: true, permissions: true } },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return { user: null, context: null };
  }

  const levels = await db.level.findMany({
    select: { name: true, rank: true },
  });

  const rows: AssignmentRowContext[] = user.roleAssignments.map((a) => ({
    id: a.id,
    roleId: a.roleId,
    levelName: a.levelName,
    scope: a.scope,
    status: a.status,
    validFrom: a.validFrom,
    validTo: a.validTo ?? null,
    actsForUserId: a.actsForUserId ?? null,
    role: a.role
      ? { id: a.role.id, name: a.role.name, permissions: a.role.permissions }
      : null,
  }));

  const context = assembleSeatContext(rows, levels, now);

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      employeeNumber: user.employeeNumber,
      homePlantId: user.homePlantId,
      isOwner: user.isOwner,
    },
    context,
  };
}
