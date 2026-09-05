/**
 * C12 — Org Reporting Line & Hierarchy Engine (DEPTH_02 §7).
 * Pure & DB-free engine that detects cycles in management hierarchies (DAG validation),
 * resolves active reporting lines across time windows, and builds complete org tree structures.
 */

export interface ReportingLineRecord {
  id: string;
  reportUserId: string;
  managerUserId: string;
  orgUnitId?: string | null;
  validFrom?: Date | string;
  validTo?: Date | string | null;
}

export interface OrgUnitRecord {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  headUserId?: string | null;
}

export interface OrgUserRecord {
  id: string;
  name: string;
  employeeNumber?: string | null;
  orgUnitId?: string | null;
}

export interface CycleCheckResult {
  hasCycle: boolean;
  cyclePath?: string;
  reason?: string;
}

export interface OrgHierarchyNode {
  unit: OrgUnitRecord;
  headUser: OrgUserRecord | null;
  members: OrgUserRecord[];
  children: OrgHierarchyNode[];
}

/**
 * Detects if adding a reporting line (reportUserId -> managerUserId) would create a cycle.
 * A user reporting to their manager is an edge: reportUser -> manager.
 * A cycle occurs if following manager chains from managerUserId eventually reaches reportUserId.
 */
export function detectReportingCycle(
  existingLines: readonly ReportingLineRecord[],
  newReportUserId: string,
  newManagerUserId: string,
): CycleCheckResult {
  if (newReportUserId === newManagerUserId) {
    return {
      hasCycle: true,
      reason: "User cannot report to themselves.",
      cyclePath: `${newReportUserId} -> ${newReportUserId}`,
    };
  }

  // Build map: subordinate -> manager
  const managerMap = new Map<string, string>();
  for (const line of existingLines) {
    managerMap.set(line.reportUserId, line.managerUserId);
  }

  // Follow the manager chain starting from newManagerUserId
  const visited = new Set<string>();
  const path = [newReportUserId, newManagerUserId];

  let current: string | undefined = newManagerUserId;
  while (current) {
    if (current === newReportUserId) {
      path.push(newReportUserId);
      return {
        hasCycle: true,
        reason: `Reporting cycle detected: ${path.join(" -> ")}`,
        cyclePath: path.join(" -> "),
      };
    }

    if (visited.has(current)) {
      break;
    }
    visited.add(current);

    const nextManager: string | undefined = managerMap.get(current);
    if (nextManager) {
      path.push(nextManager);
    }
    current = nextManager;
  }

  return { hasCycle: false };
}

/**
 * Filters reporting lines to those currently valid at the given timestamp.
 */
export function resolveActiveReportingLines(
  lines: readonly ReportingLineRecord[],
  now = new Date(),
): ReportingLineRecord[] {
  return lines.filter((line) => {
    if (line.validFrom) {
      const from = new Date(line.validFrom);
      if (now < from) return false;
    }
    if (line.validTo) {
      const to = new Date(line.validTo);
      if (now > to) return false;
    }
    return true;
  });
}

/**
 * Assembles flat units, users, and reporting lines into a nested hierarchy tree.
 */
export function buildOrgHierarchyTree(
  units: readonly OrgUnitRecord[],
  users: readonly OrgUserRecord[],
  _lines: readonly ReportingLineRecord[],
): OrgHierarchyNode[] {
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Group members by unit
  const unitMembersMap = new Map<string, OrgUserRecord[]>();
  for (const u of users) {
    if (u.orgUnitId) {
      const list = unitMembersMap.get(u.orgUnitId) || [];
      list.push(u);
      unitMembersMap.set(u.orgUnitId, list);
    }
  }

  // Map units by id
  const unitNodes = new Map<string, OrgHierarchyNode>();
  for (const unit of units) {
    unitNodes.set(unit.id, {
      unit,
      headUser: unit.headUserId ? userMap.get(unit.headUserId) ?? null : null,
      members: unitMembersMap.get(unit.id) || [],
      children: [],
    });
  }

  const rootNodes: OrgHierarchyNode[] = [];

  for (const unit of units) {
    const node = unitNodes.get(unit.id)!;
    if (unit.parentId && unitNodes.has(unit.parentId)) {
      unitNodes.get(unit.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}
