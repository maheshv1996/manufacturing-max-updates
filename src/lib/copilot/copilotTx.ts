/**
 * C11 — Copilot Transaction Adapters (DEPTH_05 §2/§5).
 * Strictly typed database transactions over Prisma:
 *   - getSeatContextBundleTx
 *   - submitAiProposalTx
 *   - decideAiProposalTx
 *   - getPendingProposalsTx
 *   - executeCopilotTaskTx
 * Single Prisma $transaction mutations with in-tx auditLog.create via buildAuditEvent.
 */
import type { PrismaClient } from "@prisma/client";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import {
  assembleSeatContextBundle,
  canInvokeTool,
  type SeatAssignmentInput,
  type SeatContextBundle,
  type PlantContext,
} from "./seatContext";
import {
  routeCopilotTask,
  type HardwareTier,
  type CopilotTaskDefinition,
} from "./taskRouter";
import {
  COPILOT_TOOLS,
  buildReadinessExplanation,
  build8dDraft,
  createAiProposalPayload,
} from "./toolRegistry";
import {
  validateProposalDecision,
  formatAiAuditEvent,
  type AiProposalInput,
  type ProposalDecisionInput,
} from "./approvalBroker";
import { fuseDeterministicMetrics, type EngineMetricsPayload } from "./fusion";
import type { PermissionKey } from "../org/permissions";

type Tx = import("@prisma/client").Prisma.TransactionClient;

async function audit(tx: Tx, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

export interface CopilotActor {
  id: string;
  name?: string;
  employeeNumber?: string;
  isOwner?: boolean;
}

export async function getSeatContextBundleTx(
  db: PrismaClient,
  userId: string,
  _currentUnitId?: string,
  plantIdOverride?: string,
): Promise<SeatContextBundle | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      employeeNumber: true,
      homePlantId: true,
      isOwner: true,
      isActive: true,
      roleAssignments: {
        include: {
          role: { select: { id: true, name: true, permissions: true } },
          orgUnit: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const effectivePlantId = plantIdOverride || user.homePlantId;
  let plantContext: PlantContext = {
    id: effectivePlantId || "plant-default",
    code: "PLANT-01",
    name: "Main Precision Plant",
    timezone: "Asia/Kolkata",
    activeShifts: ["SHIFT_A", "SHIFT_B"],
  };

  if (effectivePlantId) {
    const plantRow = await db.plant.findUnique({
      where: { id: effectivePlantId },
      select: { id: true, code: true, name: true },
    });
    if (plantRow) {
      plantContext = {
        id: plantRow.id,
        code: plantRow.code || "PLANT-01",
        name: plantRow.name,
        timezone: "Asia/Kolkata",
        activeShifts: ["SHIFT_A", "SHIFT_B"],
      };
    }
  }

  const levels = await db.level.findMany({
    select: { name: true, rank: true },
  });

  const reportingLines = await db.reportingLine.findMany({
    where: {
      OR: [{ reportUserId: user.id }, { managerUserId: user.id }],
      validTo: null,
    },
    select: { managerUserId: true, reportUserId: true },
  });

  const managerLine = reportingLines.find((r) => r.reportUserId === user.id);
  const directReports = reportingLines
    .filter((r) => r.managerUserId === user.id)
    .map((r) => r.reportUserId);

  const pendingApprovalsCount = await db.approvalTask.count({
    where: {
      assignedToUserId: user.id,
      status: "PENDING",
    },
  });

  const assignmentsInput: SeatAssignmentInput[] = user.roleAssignments.map((a) => ({
    id: a.id,
    orgUnitId: a.orgUnitId,
    orgUnitName: a.orgUnit.name,
    orgUnitCode: a.orgUnit.code,
    roleId: a.roleId,
    roleName: a.role.name,
    permissions: a.role.permissions as PermissionKey[],
    levelName: a.levelName,
    scope: (a.scope as "SELF" | "TEAM" | "UNIT" | "PLANT" | "ALL") || "SELF",
    status: (a.status as "ACTIVE" | "ACTING" | "SUSPENDED" | "EXITED") || "ACTIVE",
    validFrom: a.validFrom,
    validTo: a.validTo ?? null,
    actsForUserId: a.actsForUserId ?? null,
  }));

  return assembleSeatContextBundle({
    user: {
      id: user.id,
      name: user.name || user.id,
      employeeNumber: user.employeeNumber ?? user.id,
      homePlantId: user.homePlantId,
      isOwner: user.isOwner,
      preferredLanguage: "EN",
    },
    plant: plantContext,
    assignments: assignmentsInput,
    levels,
    reporting: {
      managerUserId: managerLine ? managerLine.managerUserId : null,
      directReportUserIds: directReports,
      deputyUserIds: [],
    },
    workload: {
      pendingApprovalsCount,
      dueDocumentsCount: 0,
      activeTasksCount: 0,
    },
    now: new Date(),
  });
}

export async function submitAiProposalTx(
  db: PrismaClient,
  proposal: AiProposalInput,
  actor: CopilotActor,
): Promise<{ proposalId: string }> {
  return await db.$transaction(async (tx) => {
    const task = await tx.approvalTask.create({
      data: {
        entityType: "AI_PROPOSAL",
        entityId: proposal.entityId || `gen-${Date.now()}`,
        stepIndex: 1,
        status: "PENDING",
        assignedToUserId: proposal.targetApproverUserId || null,
        criteriaSnapshot: proposal as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "AI_PROPOSAL_CREATED",
      entityType: proposal.entityType,
      entityId: task.id,
      details: JSON.stringify({
        proposalType: proposal.proposalType,
        initiator: proposal.initiator,
        actionSummary: proposal.actionSummary,
      }),
    });

    return { proposalId: task.id };
  });
}

export interface DecideProposalInput {
  proposalId: string;
  decision: "ACCEPT" | "REJECT";
  reason: string;
  actor: CopilotActor;
  actorPermissions: string[];
  actorLevelRank: number;
  actorSeatId?: string;
}

export async function decideAiProposalTx(
  db: PrismaClient,
  input: DecideProposalInput,
): Promise<{ success: boolean; error?: string }> {
  const task = await db.approvalTask.findUnique({
    where: { id: input.proposalId },
  });

  if (!task || task.entityType !== "AI_PROPOSAL") {
    return { success: false, error: "Proposal not found" };
  }

  if (task.status !== "PENDING") {
    return { success: false, error: `Proposal already decided (${task.status})` };
  }

  const proposal = task.criteriaSnapshot as unknown as AiProposalInput;
  const decisionInput: ProposalDecisionInput = {
    proposal,
    deciderUserId: input.actor.id,
    decision: input.decision,
    reason: input.reason,
    deciderPermissions: input.actorPermissions,
    deciderLevelRank: input.actorLevelRank,
  };

  const check = validateProposalDecision(decisionInput);
  if (!check.allowed) {
    return { success: false, error: check.reason || check.error };
  }

  const formattedAudit = formatAiAuditEvent(proposal, {
    decision: input.decision,
    deciderUserId: input.actor.id,
    deciderSeatId: input.actorSeatId || `seat-${input.actor.id}`,
    reason: input.reason,
  });

  await db.$transaction(async (tx) => {
    await tx.approvalTask.update({
      where: { id: task.id },
      data: {
        status: input.decision === "ACCEPT" ? "APPROVED" : "REJECTED",
        decidedByUserId: input.actor.id,
        decidedAt: new Date(),
        note: input.reason,
      },
    });

    await audit(tx, {
      actor: formattedAudit.approver,
      action: formattedAudit.action,
      entityType: proposal.entityType,
      entityId: proposal.entityId || task.id,
      details: formattedAudit.details,
    });
  });

  return { success: true };
}

export interface PendingProposalView {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  actionSummary: string;
  proposalType: string;
  initiatorModel: string;
  proposerUserId: string;
  createdAt: Date;
}

export async function getPendingProposalsTx(
  db: PrismaClient,
  userId?: string,
): Promise<PendingProposalView[]> {
  const tasks = await db.approvalTask.findMany({
    where: {
      entityType: "AI_PROPOSAL",
      status: "PENDING",
      ...(userId ? { assignedToUserId: userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return tasks.map((t) => {
    const p = t.criteriaSnapshot as unknown as Partial<AiProposalInput>;
    return {
      id: t.id,
      entityType: p.entityType || "N/A",
      entityId: t.entityId,
      status: t.status,
      actionSummary: p.actionSummary || "No summary",
      proposalType: p.proposalType || "GENERAL",
      initiatorModel: p.initiator?.model || "AI",
      proposerUserId: p.proposerUserId || "unknown",
      createdAt: t.createdAt,
    };
  });
}

export interface ExecuteTaskParams {
  toolId: string;
  context: Record<string, unknown>;
  actor: CopilotActor;
  activeTier?: HardwareTier;
  targetApproverUserId?: string;
}

export interface TaskExecutionResult {
  toolId: string;
  executionMode: "LLM_ASSISTED" | "DETERMINISTIC_TIER_A";
  tier: HardwareTier;
  content: string;
  fallbackNotice: string | null;
  proposal?: { id: string; status: string };
  error?: string;
}

export async function executeCopilotTaskTx(
  db: PrismaClient,
  params: ExecuteTaskParams,
): Promise<TaskExecutionResult> {
  const tool = COPILOT_TOOLS[params.toolId];
  if (!tool) {
    return {
      toolId: params.toolId,
      executionMode: "DETERMINISTIC_TIER_A",
      tier: "TIER_A",
      content: "",
      fallbackNotice: null,
      error: `Tool '${params.toolId}' is not registered in Copilot Tool Registry.`,
    };
  }

  const seatContext = await getSeatContextBundleTx(db, params.actor.id);
  if (!seatContext) {
    return {
      toolId: params.toolId,
      executionMode: "DETERMINISTIC_TIER_A",
      tier: "TIER_A",
      content: "",
      fallbackNotice: null,
      error: "User seat context could not be resolved or user is inactive.",
    };
  }

  const authCheck = canInvokeTool(seatContext, tool);
  if (!authCheck.allowed) {
    return {
      toolId: params.toolId,
      executionMode: "DETERMINISTIC_TIER_A",
      tier: "TIER_A",
      content: "",
      fallbackNotice: null,
      error: authCheck.reason || "Unauthorized tool invocation",
    };
  }

  const taskDef: CopilotTaskDefinition = {
    id: tool.id,
    name: tool.name,
    category: tool.category,
    minTier: "TIER_B",
    requiredPermission: tool.requiredPermission,
  };

  const activeTier = params.activeTier || "TIER_A";
  const routed = routeCopilotTask({
    task: taskDef,
    activeTier,
    isEndpointOnline: activeTier !== "TIER_A", // Offline if Tier A
    inputContext: params.context,
  });

  // Handle specific tool executions
  if (tool.id === "explainReadiness") {
    const checks = {
      materialReady: Boolean(params.context.materialReady),
      drawingRevValid: Boolean(params.context.drawingRevValid),
      calibrationValid: Boolean(params.context.calibrationValid),
      fixtureAvailable: Boolean(params.context.fixtureAvailable),
      faiCleared: Boolean(params.context.faiCleared),
    };
    const explanation = buildReadinessExplanation(
      String(params.context.woCode || "WO-TEMP"),
      checks,
    );
    return {
      toolId: tool.id,
      executionMode: routed.executionMode,
      tier: routed.tier,
      content: explanation,
      fallbackNotice: routed.fallbackNotice,
    };
  }

  if (tool.id === "draft8D") {
    const draftResult = build8dDraft(
      String(params.context.section || "D1"),
      params.context as {
        problemStatement: string;
        partNumber?: string;
        defectCode?: string;
        d4RootCause?: string;
        d5CorrectiveActions?: string;
        d6Validation?: string;
        d7PreventiveActions?: string;
      },
    );

    if (draftResult.error) {
      return {
        toolId: tool.id,
        executionMode: routed.executionMode,
        tier: routed.tier,
        content: "",
        fallbackNotice: routed.fallbackNotice,
        error: draftResult.error,
      };
    }

    return {
      toolId: tool.id,
      executionMode: routed.executionMode,
      tier: routed.tier,
      content: draftResult.content,
      fallbackNotice: routed.fallbackNotice,
    };
  }

  if (tool.category === "ACTION") {
    // Generates an Approval Proposal
    const proposalPayload = createAiProposalPayload({
      proposalType: (params.context.proposalType as "OVERRIDE" | "RECORD_EDIT" | "APPROVAL_PREPARE" | "NOTIFICATION") || "OVERRIDE",
      entityType: String(params.context.entityType || "General"),
      entityId: params.context.entityId ? String(params.context.entityId) : null,
      proposerUserId: params.actor.id,
      targetApproverUserId: params.targetApproverUserId || seatContext.reporting.managerUserId,
      actionSummary: String(params.context.actionSummary || "AI Proposes Action"),
      details: params.context,
      modelName: activeTier === "TIER_A" ? "RuleEngine-v2" : "LocalLLM",
      requestId: `req-${Date.now()}`,
      tier: activeTier,
    });

    if (proposalPayload.error) {
      return {
        toolId: tool.id,
        executionMode: routed.executionMode,
        tier: routed.tier,
        content: "",
        fallbackNotice: routed.fallbackNotice,
        error: proposalPayload.error,
      };
    }

    const { proposalId } = await submitAiProposalTx(db, proposalPayload.proposal, params.actor);

    return {
      toolId: tool.id,
      executionMode: routed.executionMode,
      tier: routed.tier,
      content: `AI Proposal created successfully: ${proposalPayload.proposal.actionSummary}. Awaiting supervisor approval.`,
      fallbackNotice: routed.fallbackNotice,
      proposal: { id: proposalId, status: "PENDING" },
    };
  }

  // Default deterministic fallback
  const rawText = `Tool ${tool.name} processed for context: ${JSON.stringify(params.context)}`;
  const fused = fuseDeterministicMetrics(rawText, params.context as EngineMetricsPayload);

  return {
    toolId: tool.id,
    executionMode: routed.executionMode,
    tier: routed.tier,
    content: fused,
    fallbackNotice: routed.fallbackNotice,
  };
}
