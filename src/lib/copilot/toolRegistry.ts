/**
 * C11 — Copilot Tool Registry (DEPTH_05 §5).
 * Pure & DB-free tool catalog and execution formatters:
 *   - Read tools: summarizeRecord, explainReadiness, explainOee, traceGenealogy
 *   - Draft tools: draft8D, draftNcr, draftComplaintReply, draftIncidentNarrative
 *   - Action tools (mutation): prepareApproval, proposeOverride, proposeRecordEdit
 */
import type { CopilotToolDefinition } from "./seatContext";
import type { AiProposalInput, ProposalType } from "./approvalBroker";
import { evaluateGuardrails } from "./approvalBroker";

export interface ToolCatalogEntry extends CopilotToolDefinition {
  id: string;
  category: "READ" | "DRAFT" | "ACTION";
  description: string;
}

export const COPILOT_TOOLS: Record<string, ToolCatalogEntry> = {
  summarizeRecord: {
    id: "summarizeRecord",
    name: "Summarize Record",
    category: "READ",
    requiredPermission: "ops.view",
    minLevelRank: 1,
    description: "Produces a concise operational summary of any entity record within scope.",
  },
  explainReadiness: {
    id: "explainReadiness",
    name: "Explain WO Readiness",
    category: "READ",
    requiredPermission: "terminal.use",
    minLevelRank: 1,
    description: "Explains shopfloor work order readiness gates (material, certs, drawing, fixture, cal, FAI).",
  },
  draft8D: {
    id: "draft8D",
    name: "Draft 8D Section",
    category: "DRAFT",
    requiredPermission: "quality.edit",
    minLevelRank: 2,
    description: "Drafts sections D1 through D8 of an 8D CAPA with G-3 evidence enforcement.",
  },
  draftNcr: {
    id: "draftNcr",
    name: "Draft NCR & Containment",
    category: "DRAFT",
    requiredPermission: "quality.edit",
    minLevelRank: 2,
    description: "Drafts non-conformance report defect description and immediate quarantine disposition.",
  },
  draftComplaintReply: {
    id: "draftComplaintReply",
    name: "Draft Complaint Acknowledgment",
    category: "DRAFT",
    requiredPermission: "commercial.edit",
    minLevelRank: 2,
    description: "Drafts formal customer complaint acknowledgment within the 24-hour SLA window.",
  },
  draftIncidentNarrative: {
    id: "draftIncidentNarrative",
    name: "Draft Safety Incident Narrative",
    category: "DRAFT",
    requiredPermission: "ehs.edit",
    minLevelRank: 2,
    description: "Drafts initial EHS incident narrative and immediate corrective actions.",
  },
  prepareApproval: {
    id: "prepareApproval",
    name: "Prepare Approval Task",
    category: "ACTION",
    requiredPermission: "ops.approve",
    minLevelRank: 3,
    description: "Prepares an ApprovalTask for human supervisor sign-off.",
  },
  proposeOverride: {
    id: "proposeOverride",
    name: "Propose KPI Override",
    category: "ACTION",
    requiredPermission: "kpi.override",
    minLevelRank: 4,
    description: "Proposes an operational or KPI override requiring human manager approval.",
  },
  proposeRecordEdit: {
    id: "proposeRecordEdit",
    name: "Propose Record Edit",
    category: "ACTION",
    requiredPermission: "records.edit",
    minLevelRank: 3,
    description: "Proposes an audited modification to an existing source record.",
  },
};

export function buildReadinessExplanation(
  woCode: string,
  checks: {
    materialReady: boolean;
    drawingRevValid: boolean;
    calibrationValid: boolean;
    fixtureAvailable: boolean;
    faiCleared: boolean;
  },
): string {
  const blockers: string[] = [];
  if (!checks.materialReady) blockers.push("Raw material lot or required mill cert is missing");
  if (!checks.drawingRevValid) blockers.push("Drawing revision is outdated compared to released ECO");
  if (!checks.calibrationValid) blockers.push("Inspection instrument calibration is expired");
  if (!checks.fixtureAvailable) blockers.push("Designated tooling fixture is currently under maintenance");
  if (!checks.faiCleared) blockers.push("AS9102 First Article Inspection (FAI) has not been approved");

  if (blockers.length === 0) {
    return `Work Order ${woCode} has cleared all readiness gates and is READY for shopfloor setup.`;
  }

  return `Work Order ${woCode} is BLOCKED by ${blockers.length} gate(s):\n- ${blockers.join("\n- ")}`;
}

export function build8dDraft(
  section: string,
  context: {
    problemStatement: string;
    partNumber?: string;
    defectCode?: string;
    d4RootCause?: string;
    d5CorrectiveActions?: string;
    d6Validation?: string;
    d7PreventiveActions?: string;
  },
): { content: string; error?: string } {
  if (section === "D8") {
    if (
      !context.d4RootCause ||
      !context.d5CorrectiveActions ||
      !context.d6Validation ||
      !context.d7PreventiveActions
    ) {
      return {
        content: "",
        error:
          "Guardrail G-3: Cannot draft or submit D8 closure without complete D4 (root cause), D5 (corrective actions), D6 (validation), and D7 (preventive actions).",
      };
    }
  }

  const s = section.toUpperCase();
  switch (s) {
    case "D1":
      return {
        content: `D1 - Champion & Team: Cross-functional team formed covering Quality, Production, and Design for part ${context.partNumber ?? "N/A"}.`,
      };
    case "D2":
      return {
        content: `D2 - Problem Description: ${context.problemStatement}. Defect identified as ${context.defectCode ?? "NON_CONFORMANCE"}.`,
      };
    case "D3":
      return {
        content: `D3 - Interim Containment Action: Quarantined suspect lot in MRB crib. 100% sorting enacted for WIP inventory.`,
      };
    case "D4":
      return {
        content: `D4 - Root Cause Analysis (5-Why): ${context.d4RootCause ?? "Investigation via Ishikawa diagram underway."}`,
      };
    case "D5":
      return {
        content: `D5 - Permanent Corrective Actions: ${context.d5CorrectiveActions ?? "Corrective tool path adjustments implemented."}`,
      };
    case "D6":
      return {
        content: `D6 - Validation & Verification: ${context.d6Validation ?? "Measured next 10 consecutive pieces with zero non-conformances."}`,
      };
    case "D7":
      return {
        content: `D7 - Preventative Systemic Measures: ${context.d7PreventiveActions ?? "Standard Operating Procedure (SOP) updated; operator training logged."}`,
      };
    case "D8":
      return {
        content: `D8 - Congratulate Team & Closure: Verified permanent closure of issue. Corrective and preventive actions demonstrated stable process capability.`,
      };
    default:
      return { content: `8D Section ${section}: Context analyzed for ${context.problemStatement}.` };
  }
}

export function createAiProposalPayload(input: {
  proposalType: ProposalType;
  entityType: string;
  entityId?: string | null;
  proposerUserId: string;
  targetApproverUserId?: string | null;
  actionSummary: string;
  details: Record<string, unknown>;
  modelName: string;
  requestId: string;
  tier: string;
}): { proposal: AiProposalInput; error?: string } {
  const proposal: AiProposalInput = {
    id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    proposalType: input.proposalType,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    initiator: {
      model: input.modelName,
      requestId: input.requestId,
      tier: input.tier,
    },
    proposerUserId: input.proposerUserId,
    targetApproverUserId: input.targetApproverUserId ?? null,
    actionSummary: input.actionSummary,
    details: input.details,
  };

  const guardrailCheck = evaluateGuardrails(proposal, {
    isFaiRequired: Boolean(input.details.isFaiRequired),
    isHoldPoint: Boolean(input.details.isHoldPoint),
    isCalibrationExpired: Boolean(input.details.isCalibrationExpired),
    isEcoEffective: input.details.isEcoEffective !== undefined ? Boolean(input.details.isEcoEffective) : undefined,
  });

  if (!guardrailCheck.passed) {
    return { proposal, error: guardrailCheck.reason };
  }

  return { proposal };
}
