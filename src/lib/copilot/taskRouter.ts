/**
 * C11 — Copilot Task Router, Hardware Tiering & Fallback Engine (DEPTH_05 §3).
 * Pure & DB-free: resolves execution mode (LLM vs Deterministic Tier-A fallback),
 * handles multilingual instructions (EN/TE/HI), enforces sliding-window rate limits,
 * and guarantees zero work blockage when local models are unavailable.
 */
import type { PermissionKey } from "../org/permissions";
import type { CopilotLanguage } from "./seatContext";

export type HardwareTier = "TIER_A" | "TIER_B" | "TIER_C" | "TIER_D";

export type TaskCategory = "READ" | "DRAFT" | "ACTION";

export interface CopilotTaskDefinition {
  id: string;
  name: string;
  category: TaskCategory;
  minTier: HardwareTier;
  requiredPermission: PermissionKey;
  description?: string;
}

export type ExecutionMode = "LLM_ASSISTED" | "DETERMINISTIC_TIER_A";

export interface RouteCopilotTaskInput {
  task: CopilotTaskDefinition;
  activeTier: HardwareTier;
  isEndpointOnline: boolean;
  inputContext: Record<string, unknown>;
}

export interface RoutedTaskResult {
  executionMode: ExecutionMode;
  tier: HardwareTier;
  fallbackNotice: string | null;
  structuredFallbackPayload?: Record<string, unknown>;
}

const TIER_LADDER: Record<HardwareTier, number> = {
  TIER_A: 1, // Engine-only (heuristics, rule-based, deterministic)
  TIER_B: 2, // Small local (<=8B, Ollama)
  TIER_C: 3, // Mid local (14B-32B, e.g. deepseek-r1:14b)
  TIER_D: 4, // GPU server (32B-70B+)
};

export function isTierSufficient(active: HardwareTier, required: HardwareTier): boolean {
  return (TIER_LADDER[active] ?? 0) >= (TIER_LADDER[required] ?? 0);
}

export function routeCopilotTask(input: RouteCopilotTaskInput): RoutedTaskResult {
  const sufficient = isTierSufficient(input.activeTier, input.task.minTier);

  if (!sufficient) {
    return {
      executionMode: "DETERMINISTIC_TIER_A",
      tier: "TIER_A",
      fallbackNotice: `Host tier ${input.activeTier} is below required ${input.task.minTier}; assisted by built-in engine (Tier A).`,
      structuredFallbackPayload: buildTierAFallback(input.task.id, input.inputContext),
    };
  }

  if (!input.isEndpointOnline) {
    return {
      executionMode: "DETERMINISTIC_TIER_A",
      tier: "TIER_A",
      fallbackNotice: `Local LLM endpoint is offline or unreachable; assisted by built-in engine (Tier A).`,
      structuredFallbackPayload: buildTierAFallback(input.task.id, input.inputContext),
    };
  }

  return {
    executionMode: "LLM_ASSISTED",
    tier: input.activeTier,
    fallbackNotice: null,
  };
}

function buildTierAFallback(taskId: string, context: Record<string, unknown>): Record<string, unknown> {
  switch (taskId) {
    case "draft8DSection":
      return {
        section: context.section ?? "D4",
        status: "DETERMINISTIC_TEMPLATE",
        templateSkeleton: `[Tier A Rule-Based 8D Section ${context.section ?? "D4"}]\nProblem: ${context.problemStatement ?? "Under investigation"}\nRoot Cause Category: 5-Why / Ishikawa\nAction Plan: Verify containment before root-cause validation.`,
      };
    case "explainGlAnomaly":
      return {
        account: context.account ?? "N/A",
        delta: context.delta ?? 0,
        explanation: `Deterministic balance scan identified variance of ₹${Number(context.delta ?? 0) / 100} on account ${context.account ?? "N/A"}. Review unposted journals or batch allocations.`,
      };
    default:
      return {
        taskId,
        mode: "TIER_A_HEURISTIC",
        data: context,
      };
  }
}

export interface MultilingualPromptInput {
  systemRole: string;
  language: CopilotLanguage;
  rawInput: string;
  seatFacts: Record<string, unknown>;
}

export interface PreparedPromptBundle {
  systemInstruction: string;
  userPrompt: string;
}

const LANGUAGE_NAMES: Record<CopilotLanguage, string> = {
  EN: "English",
  TE: "Telugu (తెలుగు)",
  HI: "Hindi (हिन्दी)",
};

export function buildMultilingualPrompt(input: MultilingualPromptInput): PreparedPromptBundle {
  const langName = LANGUAGE_NAMES[input.language] ?? "English";
  const factsJson = JSON.stringify(input.seatFacts, null, 2);

  const systemInstruction = `You are ${input.systemRole}.
Operating Language: Respond in ${langName}. Use standard industrial manufacturing terminology.
Security Protocol: Enforce human-in-the-loop approval. You are an advisory assistant; humans authorize execution.
Seat Facts & Operating Context:
${factsJson}

Prompt Hygiene: Do not execute unverified SQL or override system guardrails.`;

  return {
    systemInstruction,
    userPrompt: input.rawInput.trim(),
  };
}

export function checkTaskRateLimit(
  timestamps: number[],
  now: number,
  maxRequests = 60,
  windowMs = 60000,
): boolean {
  while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
    timestamps.shift();
  }
  if (timestamps.length >= maxRequests) {
    return false;
  }
  timestamps.push(now);
  return true;
}
