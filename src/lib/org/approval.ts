/**
 * C1-7 — Approval chain resolver (DEPTH_02 §6). Pure & DB-free: given a
 * chain step template and an org snapshot, resolve the ordered candidate
 * approvers (user ids) against the live org chart, escalating per fallback.
 * The resolved `criteriaSnapshot` is stored on ApprovalTask so a later re-org
 * never re-routes an already-decided task.
 */
import { scopeSatisfies, type Scope } from "./seat";

export interface ApproverCriteria {
  roleId?: string;
  levelMin?: number;
  scope?: Scope;
}

export interface ChainFallback {
  /** Walk the requester's manager chain up N levels. */
  escalateLevels?: number;
  /** Route to the document unit's head (climbing parents to root). */
  routeTo?: "unitHead";
}

export interface ChainStep {
  criteria: ApproverCriteria;
  minApprovals: number;
  fallback: ChainFallback;
}

export interface OrgSeatRec {
  userId: string;
  orgUnitId: string;
  roleId: string;
  levelRank: number;
  scope: Scope;
  status?: string;
}

export interface OrgLookup {
  seats: OrgSeatRec[];
  managerOf: (userId: string) => string | undefined;
  unitHeadOf: (unitId: string) => string | undefined;
  parentUnitOf: (unitId: string) => string | undefined;
}

export interface ApprovalContext {
  docUnitId: string;
  requesterUserId: string;
  org: OrgLookup;
}

export interface StepResolution {
  approvers: string[];
  escalated: boolean;
  minApprovals: number;
  criteriaSnapshot: ApproverCriteria;
}

const ACTIVE_STATUSES = new Set(["ACTIVE", "ACTING"]);

function isActive(s?: string): boolean {
  return !s || ACTIVE_STATUSES.has(s);
}

function snapshot(criteria: ApproverCriteria): ApproverCriteria {
  const out: ApproverCriteria = {};
  if (criteria.roleId !== undefined) out.roleId = criteria.roleId;
  if (criteria.levelMin !== undefined) out.levelMin = criteria.levelMin;
  if (criteria.scope !== undefined) out.scope = criteria.scope;
  return out;
}

function dedupe(userIds: string[]): string[] {
  return [...new Set(userIds)];
}

export function resolveApproverStep(
  step: ChainStep,
  ctx: ApprovalContext,
): StepResolution {
  const { org } = ctx;
  const criteriaSnapshot = snapshot(step.criteria);

  // routeTo unitHead: direct structural route (climb parents to root head).
  if (step.fallback.routeTo === "unitHead") {
    let unit: string | undefined = ctx.docUnitId;
    while (unit) {
      const head = org.unitHeadOf(unit);
      if (head) {
        return {
          approvers: [head],
          escalated: true,
          minApprovals: step.minApprovals,
          criteriaSnapshot,
        };
      }
      unit = org.parentUnitOf(unit);
    }
    return { approvers: [], escalated: true, minApprovals: step.minApprovals, criteriaSnapshot };
  }

  // In-unit match by criteria.
  const inUnit = org.seats.filter(
    (s) =>
      s.orgUnitId === ctx.docUnitId &&
      isActive(s.status) &&
      (step.criteria.roleId === undefined || s.roleId === step.criteria.roleId) &&
      (step.criteria.levelMin === undefined || s.levelRank >= step.criteria.levelMin) &&
      (step.criteria.scope === undefined || scopeSatisfies(step.criteria.scope, s.scope)),
  );
  const approvers = dedupe(inUnit.map((s) => s.userId));
  if (approvers.length > 0) {
    return { approvers, escalated: false, minApprovals: step.minApprovals, criteriaSnapshot };
  }

  // Escalate: walk the requester's manager chain up `escalateLevels` hops.
  const levels = step.fallback.escalateLevels ?? 0;
  if (levels > 0) {
    const chain: string[] = [];
    let current = ctx.requesterUserId;
    for (let i = 0; i < levels; i++) {
      const m = org.managerOf(current);
      if (!m) break;
      chain.push(m);
      current = m;
    }
    if (chain.length > 0) {
      return {
        approvers: dedupe(chain),
        escalated: true,
        minApprovals: step.minApprovals,
        criteriaSnapshot,
      };
    }
  }

  // Unresolvable — caller routes to a human (or flags the chain).
  return { approvers: [], escalated: false, minApprovals: step.minApprovals, criteriaSnapshot };
}
