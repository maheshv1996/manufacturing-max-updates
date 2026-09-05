/**
 * C11 — Copilot Seat Context Assembler & Scope Trimmer (DEPTH_05 §4, DEPTH_02 §10).
 * Pure & DB-free: resolves live user identity, active seats, effective scope,
 * level rank, reporting chain, and workload snapshot into a secure AI seat bundle.
 * Enforces prompt hygiene: scope trimming happens before data reaches any model.
 */
import type { Scope, SeatStatus } from "../org/seat";
import type { PermissionKey } from "../org/permissions";
import { isPermissionKey } from "../org/permissions";

export type CopilotLanguage = "EN" | "TE" | "HI";

export interface SeatAssignmentInput {
  id: string;
  orgUnitId: string;
  orgUnitName: string;
  orgUnitCode: string;
  roleId: string;
  roleName: string;
  permissions: readonly PermissionKey[];
  levelName: string;
  scope: Scope;
  status: SeatStatus;
  validFrom: Date | string;
  validTo?: Date | string | null;
  actsForUserId?: string | null;
}

export interface LevelLadderItem {
  name: string;
  rank: number;
}

export interface SeatUserIdentity {
  userId: string;
  name: string;
  employeeNumber: string;
  homePlantId?: string | null;
  isOwner: boolean;
  preferredLanguage: CopilotLanguage;
  terminalContext?: {
    terminalId: string;
    stationName: string;
  } | null;
}

export interface PlantContext {
  id: string;
  code: string;
  name: string;
  timezone: string;
  activeShifts: string[];
}

export interface ReportingChain {
  managerUserId?: string | null;
  directReportUserIds: string[];
  deputyUserIds: string[];
}

export interface WorkloadSnapshot {
  pendingApprovalsCount: number;
  dueDocumentsCount: number;
  activeTasksCount: number;
}

export interface ActiveSeatView {
  assignmentId: string;
  orgUnitId: string;
  orgUnitName: string;
  orgUnitCode: string;
  roleId: string;
  roleName: string;
  levelName: string;
  levelRank: number;
  scope: Scope;
  status: SeatStatus;
  actsForUserId: string | null;
}

export interface SeatContextBundle {
  identity: SeatUserIdentity;
  plant: PlantContext;
  activeSeats: ActiveSeatView[];
  activeRoleCodes: string[];
  effectivePerms: PermissionKey[];
  effectiveLevel: number;
  effectiveScope: Scope;
  actingForUserId: string | null;
  reporting: ReportingChain;
  workload: WorkloadSnapshot;
}

export interface AssembleSeatContextBundleInput {
  user: {
    id: string;
    name: string;
    employeeNumber: string;
    homePlantId?: string | null;
    isOwner: boolean;
    preferredLanguage?: string | null;
    terminalContext?: {
      terminalId: string;
      stationName: string;
    } | null;
  };
  plant: PlantContext;
  assignments: readonly SeatAssignmentInput[];
  levels: readonly LevelLadderItem[];
  reporting: ReportingChain;
  workload: WorkloadSnapshot;
  now?: Date;
}

const SCOPE_LADDER: Record<Scope, number> = {
  SELF: 0,
  TEAM: 1,
  UNIT: 2,
  PLANT: 3,
  ALL: 4,
};

function highestScope(scopes: readonly Scope[]): Scope {
  let highest: Scope = "SELF";
  let maxRank = 0;
  for (const s of scopes) {
    const r = SCOPE_LADDER[s] ?? 0;
    if (r > maxRank) {
      maxRank = r;
      highest = s;
    }
  }
  return highest;
}

function normalizeLanguage(lang?: string | null): CopilotLanguage {
  if (lang === "TE") return "TE";
  if (lang === "HI") return "HI";
  return "EN";
}

export function assembleSeatContextBundle(
  input: AssembleSeatContextBundleInput,
): SeatContextBundle {
  const now = input.now ?? new Date();
  const ladder = new Map(input.levels.map((l) => [l.name, l.rank]));

  // Filter active assignments within validity window
  const activeAssignments = input.assignments.filter((a) => {
    if (a.status !== "ACTIVE" && a.status !== "ACTING") return false;
    const from = new Date(a.validFrom);
    if (now < from) return false;
    if (a.validTo) {
      const to = new Date(a.validTo);
      if (now > to) return false;
    }
    return ladder.has(a.levelName);
  });

  const activeSeats: ActiveSeatView[] = activeAssignments.map((a) => ({
    assignmentId: a.id,
    orgUnitId: a.orgUnitId,
    orgUnitName: a.orgUnitName,
    orgUnitCode: a.orgUnitCode,
    roleId: a.roleId,
    roleName: a.roleName,
    levelName: a.levelName,
    levelRank: ladder.get(a.levelName) ?? 0,
    scope: a.scope,
    status: a.status,
    actsForUserId: a.actsForUserId ?? null,
  }));

  const activeRoleCodes = [
    ...new Set(activeSeats.map((s) => s.roleName).filter(Boolean)),
  ];

  const permissionsSet = new Set<PermissionKey>();
  for (const a of activeAssignments) {
    for (const p of a.permissions) {
      if (isPermissionKey(p)) {
        permissionsSet.add(p);
      }
    }
  }

  // Owner root grant
  if (input.user.isOwner) {
    permissionsSet.add("users.manage");
    permissionsSet.add("audit.view");
    permissionsSet.add("kpi.override");
    permissionsSet.add("records.edit");
    permissionsSet.add("reports.print");
    permissionsSet.add("terminal.use");
  }

  const effectivePerms = [...permissionsSet];
  const effectiveLevel = activeSeats.reduce(
    (max, s) => Math.max(max, s.levelRank),
    input.user.isOwner ? 5 : 0,
  );
  const effectiveScope = input.user.isOwner
    ? "ALL"
    : highestScope(activeSeats.map((s) => s.scope));

  const actingSeat = activeSeats.find((s) => s.status === "ACTING" && s.actsForUserId);
  const actingForUserId = actingSeat ? actingSeat.actsForUserId : null;

  return {
    identity: {
      userId: input.user.id,
      name: input.user.name,
      employeeNumber: input.user.employeeNumber,
      homePlantId: input.user.homePlantId ?? null,
      isOwner: input.user.isOwner,
      preferredLanguage: normalizeLanguage(input.user.preferredLanguage),
      terminalContext: input.user.terminalContext ?? null,
    },
    plant: input.plant,
    activeSeats,
    activeRoleCodes,
    effectivePerms,
    effectiveLevel,
    effectiveScope,
    actingForUserId,
    reporting: input.reporting,
    workload: input.workload,
  };
}

export interface ScopeTrimCriteria {
  scope: Scope;
  userId: string;
  teamIds?: string[];
  unitId?: string;
  plantId?: string;
}

export interface ScopedRecordBase {
  createdByUserId?: string | null;
  teamId?: string | null;
  orgUnitId?: string | null;
  plantId?: string | null;
}

/**
 * Pure scope trimmer (DEPTH_05 §4). Filters records prior to being
 * offered to any AI copilot model or context window.
 */
export function trimDataByScope<T extends ScopedRecordBase>(
  records: readonly T[],
  criteria: ScopeTrimCriteria,
): T[] {
  if (criteria.scope === "ALL") {
    return [...records];
  }

  return records.filter((r) => {
    switch (criteria.scope) {
      case "SELF":
        return r.createdByUserId === criteria.userId;

      case "TEAM":
        if (r.createdByUserId === criteria.userId) return true;
        if (criteria.teamIds && r.teamId && criteria.teamIds.includes(r.teamId)) {
          return true;
        }
        return false;

      case "UNIT":
        if (r.createdByUserId === criteria.userId) return true;
        if (criteria.unitId && r.orgUnitId === criteria.unitId) return true;
        return false;

      case "PLANT":
        if (r.createdByUserId === criteria.userId) return true;
        if (criteria.plantId && r.plantId === criteria.plantId) return true;
        return false;

      default:
        return false;
    }
  });
}

export interface CopilotToolDefinition {
  name: string;
  requiredPermission: PermissionKey;
  minLevelRank: number;
}

export interface ToolInvocationCheck {
  allowed: boolean;
  reason?: string;
}

export function canInvokeTool(
  bundle: Pick<SeatContextBundle, "effectivePerms" | "effectiveLevel" | "identity">,
  tool: CopilotToolDefinition,
): ToolInvocationCheck {
  if (bundle.identity.isOwner) {
    return { allowed: true };
  }

  if (!bundle.effectivePerms.includes(tool.requiredPermission)) {
    return {
      allowed: false,
      reason: `Missing required permission key '${tool.requiredPermission}'`,
    };
  }

  if (bundle.effectiveLevel < tool.minLevelRank) {
    return {
      allowed: false,
      reason: `Insufficient level rank: requires ${tool.minLevelRank}, seat holds ${bundle.effectiveLevel}`,
    };
  }

  return { allowed: true };
}
