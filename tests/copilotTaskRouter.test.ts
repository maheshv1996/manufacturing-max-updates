import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  routeCopilotTask,
  buildMultilingualPrompt,
  checkTaskRateLimit,
  isTierSufficient,
  type CopilotTaskDefinition,
} from "../src/lib/copilot/taskRouter.ts";

describe("Copilot TaskRouter — Tiering & Fallbacks", () => {
  it("enforces tier sufficiency correctly across hardware ladder", () => {
    assert.equal(isTierSufficient("TIER_A", "TIER_A"), true);
    assert.equal(isTierSufficient("TIER_A", "TIER_B"), false);
    assert.equal(isTierSufficient("TIER_C", "TIER_B"), true);
    assert.equal(isTierSufficient("TIER_C", "TIER_C"), true);
    assert.equal(isTierSufficient("TIER_C", "TIER_D"), false);
    assert.equal(isTierSufficient("TIER_D", "TIER_A"), true);
  });

  it("routes task to LLM when tier is sufficient and endpoint is healthy", () => {
    const task: CopilotTaskDefinition = {
      id: "draft8DSection",
      name: "Draft 8D Section",
      category: "DRAFT",
      minTier: "TIER_C",
      requiredPermission: "quality.edit",
    };

    const routed = routeCopilotTask({
      task,
      activeTier: "TIER_C",
      isEndpointOnline: true,
      inputContext: { section: "D4", problemStatement: "Bore chatter" },
    });

    assert.equal(routed.executionMode, "LLM_ASSISTED");
    assert.equal(routed.tier, "TIER_C");
    assert.equal(routed.fallbackNotice, null);
  });

  it("gracefully falls back to Tier A when active tier is below minimum tier", () => {
    const task: CopilotTaskDefinition = {
      id: "draft8DSection",
      name: "Draft 8D Section",
      category: "DRAFT",
      minTier: "TIER_C",
      requiredPermission: "quality.edit",
    };

    const routed = routeCopilotTask({
      task,
      activeTier: "TIER_A", // Host is running in engine-only mode
      isEndpointOnline: false,
      inputContext: { section: "D4", problemStatement: "Bore chatter" },
    });

    assert.equal(routed.executionMode, "DETERMINISTIC_TIER_A");
    assert.equal(routed.tier, "TIER_A");
    assert.ok(routed.fallbackNotice?.includes("assisted by built-in engine"));
  });

  it("gracefully falls back to Tier A when LLM endpoint is offline or unreachable", () => {
    const task: CopilotTaskDefinition = {
      id: "explainGlAnomaly",
      name: "Explain GL Anomaly",
      category: "READ",
      minTier: "TIER_B",
      requiredPermission: "finance.view",
    };

    const routed = routeCopilotTask({
      task,
      activeTier: "TIER_B",
      isEndpointOnline: false, // Model server unreachable
      inputContext: { account: "1001", delta: 12000 },
    });

    assert.equal(routed.executionMode, "DETERMINISTIC_TIER_A");
    assert.equal(routed.tier, "TIER_A");
    assert.ok(routed.fallbackNotice?.includes("offline"));
  });

  it("builds multilingual prompts incorporating seat language preference (EN/TE/HI)", () => {
    const enPrompt = buildMultilingualPrompt({
      systemRole: "Precision MES Copilot",
      language: "EN",
      rawInput: "Check machine M01 status",
      seatFacts: { machineId: "M01", operator: "Ravi" },
    });
    assert.ok(enPrompt.systemInstruction.includes("English"));
    assert.ok(enPrompt.systemInstruction.includes("Ravi"));

    const tePrompt = buildMultilingualPrompt({
      systemRole: "Precision MES Copilot",
      language: "TE",
      rawInput: "M01 స్థితిని తనిఖీ చేయండి",
      seatFacts: { machineId: "M01" },
    });
    assert.ok(tePrompt.systemInstruction.includes("Telugu"));

    const hiPrompt = buildMultilingualPrompt({
      systemRole: "Precision MES Copilot",
      language: "HI",
      rawInput: "M01 की स्थिति जांचें",
      seatFacts: { machineId: "M01" },
    });
    assert.ok(hiPrompt.systemInstruction.includes("Hindi"));
  });

  it("enforces sliding window rate limits", () => {
    const timestamps: number[] = [];
    const now = 1000000;
    const limit = 5;
    const windowMs = 60000;

    for (let i = 0; i < 5; i++) {
      assert.equal(checkTaskRateLimit(timestamps, now + i * 100, limit, windowMs), true);
    }
    // 6th call within window should be rejected
    assert.equal(checkTaskRateLimit(timestamps, now + 600, limit, windowMs), false);

    // Call after window passes should succeed
    assert.equal(checkTaskRateLimit(timestamps, now + windowMs + 1000, limit, windowMs), true);
  });
});
