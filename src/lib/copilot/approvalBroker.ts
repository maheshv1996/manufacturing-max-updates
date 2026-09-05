/**
 * C11 — Copilot Approval Broker & Guardrail Engine (DEPTH_05 §5, DEPTH_01 §6).
 * Pure & DB-free: enforces human-in-the-loop (AI-2), prevents AI self-approval,
 * validates guardrails G-1 through G-6, and formats tamper-evident in-tx audit payloads.
 */
import type { PermissionKey } from "../org/permissions";

export type ProposalType =
  | "OVERRIDE"
  | "RECORD_EDIT"
  | "APPROVAL_PREPARE"
  | "NOTIFICATION";

export interface AiInitiatorInfo {
  model: string;
  requestId: string;
  tier: string;
}

export interface AiProposalInput {
  id: string;
  proposalType: ProposalType;
  entityType: string;
  entityId?: string | null;
  initiator: AiInitiatorInfo;
  proposerUserId: string;
  targetApproverUserId?: string | null;
  actionSummary: string;
  details: Record<string, unknown>;
}

export interface GuardrailContext {
  isFaiRequired?: boolean;
  isHoldPoint?: boolean;
  isCalibrationExpired?: boolean;
  isEcoEffective?: boolean;
}

export interface GuardrailEvaluationResult {
  passed: boolean;
  blockedGuardrail?: "G-1" | "G-2" | "G-3" | "G-4" | "G-5" | "G-6";
  reason: string;
}

export interface ProposalDecisionInput {
  proposal: AiProposalInput;
  deciderUserId: string;
  decision: "ACCEPT" | "REJECT";
  reason: string;
  deciderPermissions: readonly string[];
  deciderLevelRank: number;
}

export interface DecisionValidationResult {
  allowed: boolean;
  error?: "SELF_APPROVAL_BLOCKED" | "INSUFFICIENT_PERMISSIONS" | "INSUFFICIENT_LEVEL";
  reason?: string;
}

export interface FormattedAiAuditEvent {
  action: "AI_PROPOSAL_ACCEPTED" | "AI_PROPOSAL_REJECTED";
  initiator: string;
  approver: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export function evaluateGuardrails(
  proposal: AiProposalInput,
  context: GuardrailContext,
): GuardrailEvaluationResult {
  // G-1: AS9102 FAI required indicator cannot be bypassed by AI
  if (
    context.isFaiRequired &&
    (proposal.details.bypassFai === true ||
      proposal.actionSummary.toLowerCase().includes("bypass fai"))
  ) {
    return {
      passed: false,
      blockedGuardrail: "G-1",
      reason: "Guardrail G-1 violation: AI cannot propose bypassing AS9102 First Article Inspection (FAI).",
    };
  }

  // G-2: Quality hold points cannot be signed off by AI
  if (
    context.isHoldPoint &&
    (proposal.details.signOffHoldPoint === true ||
      proposal.actionSummary.toLowerCase().includes("sign off quality hold point") ||
      proposal.actionSummary.toLowerCase().includes("bypass hold point"))
  ) {
    return {
      passed: false,
      blockedGuardrail: "G-2",
      reason: "Guardrail G-2 violation: Hold point inspection sign-off requires physical stamp/credential from an authorized QC inspector.",
    };
  }

  // G-3: 8D D8 closure without D4–D7 evidence is blocked
  if (
    proposal.entityType === "Ncr8D" ||
    proposal.details.targetSection === "D8"
  ) {
    const d4 = proposal.details.d4RootCause;
    const d5 = proposal.details.d5CorrectiveActions;
    const d6 = proposal.details.d6Validation;
    const d7 = proposal.details.d7PreventiveActions;

    if (!d4 || !d5 || !d6 || !d7) {
      return {
        passed: false,
        blockedGuardrail: "G-3",
        reason: "Guardrail G-3 violation: 8D D8 closure proposal requires verified D4–D7 evidence (root cause, corrective actions, validation, and preventive actions).",
      };
    }
  }

  // G-4: Calibration validity gate
  if (
    context.isCalibrationExpired &&
    (proposal.details.bypassCalibration === true ||
      proposal.actionSummary.toLowerCase().includes("bypass calibration"))
  ) {
    return {
      passed: false,
      blockedGuardrail: "G-4",
      reason: "Guardrail G-4 violation: Expired instrument calibration cannot be bypassed by an AI proposal.",
    };
  }

  // G-5: ECO effectivity gate
  if (
    context.isEcoEffective === false &&
    proposal.actionSummary.toLowerCase().includes("implement unapproved eco")
  ) {
    return {
      passed: false,
      blockedGuardrail: "G-5",
      reason: "Guardrail G-5 violation: ECO must be formally approved and reach effectivity date before production implementation.",
    };
  }

  return { passed: true, reason: "All guardrails satisfied." };
}

export function validateProposalDecision(
  input: ProposalDecisionInput,
): DecisionValidationResult {
  // G-6: Separation of duties / Tree of trust
  // Proposer cannot approve their own AI proposal
  if (
    input.decision === "ACCEPT" &&
    input.proposal.proposerUserId &&
    input.proposal.proposerUserId === input.deciderUserId
  ) {
    return {
      allowed: false,
      error: "SELF_APPROVAL_BLOCKED",
      reason: "Guardrail G-6 violation: User cannot approve an AI proposal they initiated or requested (separation of duties).",
    };
  }

  // Permission check based on proposal type
  let requiredKey: PermissionKey = "ops.approve" as PermissionKey;
  let minRank = 3;

  if (input.proposal.proposalType === "OVERRIDE") {
    requiredKey = "kpi.override" as PermissionKey;
    minRank = 4; // LEAD or above
  } else if (input.proposal.proposalType === "RECORD_EDIT") {
    requiredKey = "records.edit" as PermissionKey;
    minRank = 3;
  }

  if (
    input.decision === "ACCEPT" &&
    !input.deciderPermissions.includes(requiredKey)
  ) {
    return {
      allowed: false,
      error: "INSUFFICIENT_PERMISSIONS",
      reason: `Approver lacks required permission '${requiredKey}'.`,
    };
  }

  if (input.decision === "ACCEPT" && input.deciderLevelRank < minRank) {
    return {
      allowed: false,
      error: "INSUFFICIENT_LEVEL",
      reason: `Approver rank ${input.deciderLevelRank} is below required rank ${minRank}.`,
    };
  }

  return { allowed: true };
}

export interface AuditEventOptions {
  decision: "ACCEPT" | "REJECT";
  deciderUserId: string;
  deciderSeatId: string;
  reason: string;
  timestamp?: Date;
}

export function formatAiAuditEvent(
  proposal: AiProposalInput,
  options: AuditEventOptions,
): FormattedAiAuditEvent {
  const isAccepted = options.decision === "ACCEPT";
  const action = isAccepted ? "AI_PROPOSAL_ACCEPTED" : "AI_PROPOSAL_REJECTED";
  const initiator = `AI (${proposal.initiator.model}, ${proposal.initiator.requestId})`;

  const detailsObj = {
    actionSummary: proposal.actionSummary,
    proposalType: proposal.proposalType,
    decisionReason: options.reason,
    proposerUserId: proposal.proposerUserId,
    details: proposal.details,
  };

  return {
    action,
    initiator,
    approver: options.deciderSeatId,
    entityType: proposal.entityType,
    entityId: proposal.entityId ?? "N/A",
    details: JSON.stringify(detailsObj),
    timestamp: (options.timestamp ?? new Date()).toISOString(),
  };
}
