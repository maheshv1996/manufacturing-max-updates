import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGuardrails,
  validateProposalDecision,
  formatAiAuditEvent,
  type AiProposalInput,
  type ProposalDecisionInput,
} from "../src/lib/copilot/approvalBroker.ts";

describe("Copilot ApprovalBroker — Guardrails & Auditing", () => {
  it("enforces G-1: blocks AI proposals that attempt to bypass AS9102 FAI requirements", () => {
    const proposal: AiProposalInput = {
      id: "prop-1",
      proposalType: "OVERRIDE",
      entityType: "WorkOrder",
      entityId: "wo-101",
      initiator: { model: "deepseek-r1:14b", requestId: "req-1", tier: "TIER_C" },
      proposerUserId: "user-eng-1",
      targetApproverUserId: "user-mgr-1",
      actionSummary: "Bypass FAI for quick prototype",
      details: { bypassFai: true },
    };

    const result = evaluateGuardrails(proposal, { isFaiRequired: true });
    assert.equal(result.passed, false);
    assert.equal(result.blockedGuardrail, "G-1");
    assert.ok(result.reason.includes("AS9102"));
  });

  it("enforces G-2: blocks AI proposals that attempt to sign off physical quality hold points", () => {
    const proposal: AiProposalInput = {
      id: "prop-2",
      proposalType: "RECORD_EDIT",
      entityType: "RoutingStep",
      entityId: "rs-202",
      initiator: { model: "deepseek-r1:14b", requestId: "req-2", tier: "TIER_C" },
      proposerUserId: "user-copilot-bot",
      targetApproverUserId: "user-qc-1",
      actionSummary: "Sign off quality hold point",
      details: { signOffHoldPoint: true },
    };

    const result = evaluateGuardrails(proposal, { isHoldPoint: true });
    assert.equal(result.passed, false);
    assert.equal(result.blockedGuardrail, "G-2");
    assert.ok(result.reason.includes("Hold point"));
  });

  it("enforces G-3: refuses 8D D8 closure when D4-D7 evidence is missing or incomplete", () => {
    const incompleteProposal: AiProposalInput = {
      id: "prop-3",
      proposalType: "APPROVAL_PREPARE",
      entityType: "Ncr8D",
      entityId: "8d-303",
      initiator: { model: "deepseek-r1:14b", requestId: "req-3", tier: "TIER_C" },
      proposerUserId: "user-qa-1",
      targetApproverUserId: "user-qa-mgr",
      actionSummary: "Submit 8D D8 closure",
      details: {
        targetSection: "D8",
        d4RootCause: "Tool chatter due to dull insert",
        d5CorrectiveActions: "Replaced tool insert",
        d6Validation: null, // Missing validation!
        d7PreventiveActions: null, // Missing preventive actions!
      },
    };

    const result = evaluateGuardrails(incompleteProposal, {});
    assert.equal(result.passed, false);
    assert.equal(result.blockedGuardrail, "G-3");
    assert.ok(result.reason.includes("D4–D7"));

    // Passes when all D4-D7 sections are provided
    const completeProposal: AiProposalInput = {
      ...incompleteProposal,
      details: {
        targetSection: "D8",
        d4RootCause: "Tool chatter due to dull insert",
        d5CorrectiveActions: "Replaced tool insert",
        d6Validation: "5 sample parts inspected with 0 defects",
        d7PreventiveActions: "Added tool life limit in CNC controller",
      },
    };
    const completeResult = evaluateGuardrails(completeProposal, {});
    assert.equal(completeResult.passed, true);
  });

  it("enforces G-6: structurally blocks self-approval (proposer cannot approve their own AI proposal)", () => {
    const proposal: AiProposalInput = {
      id: "prop-4",
      proposalType: "OVERRIDE",
      entityType: "MachineKpi",
      entityId: "m-01",
      initiator: { model: "deepseek-r1:14b", requestId: "req-4", tier: "TIER_C" },
      proposerUserId: "user-operator-1",
      targetApproverUserId: null,
      actionSummary: "Override OEE target",
      details: {},
    };

    const selfDecision: ProposalDecisionInput = {
      proposal,
      deciderUserId: "user-operator-1", // Same user!
      decision: "ACCEPT",
      reason: "Self approval attempt",
      deciderPermissions: ["kpi.override"],
      deciderLevelRank: 4,
    };

    const check = validateProposalDecision(selfDecision);
    assert.equal(check.allowed, false);
    assert.equal(check.error, "SELF_APPROVAL_BLOCKED");

    const validDecision: ProposalDecisionInput = {
      proposal,
      deciderUserId: "user-plant-head-9", // Independent manager
      decision: "ACCEPT",
      reason: "Approved after review",
      deciderPermissions: ["kpi.override"],
      deciderLevelRank: 4,
    };

    const validCheck = validateProposalDecision(validDecision);
    assert.equal(validCheck.allowed, true);
  });

  it("formats compliant in-transaction audit payload with AI initiator and human decider", () => {
    const proposal: AiProposalInput = {
      id: "prop-5",
      proposalType: "OVERRIDE",
      entityType: "WorkOrder",
      entityId: "wo-505",
      initiator: { model: "deepseek-r1:14b", requestId: "req-505", tier: "TIER_C" },
      proposerUserId: "user-operator-1",
      targetApproverUserId: "user-mgr-1",
      actionSummary: "Shift handover count adjustment",
      details: { adjustedCount: 50 },
    };

    const auditAccept = formatAiAuditEvent(proposal, {
      decision: "ACCEPT",
      deciderUserId: "user-mgr-1",
      deciderSeatId: "seat-mgr-1",
      reason: "Verified physical logsheet",
      timestamp: new Date("2026-09-05T14:00:00Z"),
    });

    assert.equal(auditAccept.action, "AI_PROPOSAL_ACCEPTED");
    assert.equal(auditAccept.initiator, "AI (deepseek-r1:14b, req-505)");
    assert.equal(auditAccept.approver, "seat-mgr-1");
    assert.equal(auditAccept.entityType, "WorkOrder");
    assert.equal(auditAccept.entityId, "wo-505");

    const auditReject = formatAiAuditEvent(proposal, {
      decision: "REJECT",
      deciderUserId: "user-mgr-1",
      deciderSeatId: "seat-mgr-1",
      reason: "Count does not match physical bin",
      timestamp: new Date("2026-09-05T14:05:00Z"),
    });

    assert.equal(auditReject.action, "AI_PROPOSAL_REJECTED");
    assert.ok(auditReject.details.includes("does not match physical bin"));
  });
});
