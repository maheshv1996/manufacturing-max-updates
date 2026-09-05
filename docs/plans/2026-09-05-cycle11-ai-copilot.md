# Cycle 11 — AI Copilot Framework (C11)

**Branch:** `v2` · **Date:** 2026-09-05 · **Status:** COMPLETE
**Spec anchor:** DEPTH_05 (AI Copilots: Local, Role-Aware, Assist-First) · DEPTH_02 §10 (Seat-Context Contract) · kilo roadmap C11
**Primary risks:** local/on-prem offline safety (AI-1), assist-first human approval loop (AI-2), seat-context & scope trimming (AI-3), deterministic numbers fusion (Principle 7).

## Scope

Typed-core implementation of the AI Copilot Framework on the C1 org spine and PostgreSQL driver adapter, strictly upholding the four non-negotiables:
1. **AI-1 (Local/On-Prem Only)**: Tier A (built-in heuristic/template engine, no model required), Tier B (small local <=8B via Ollama), Tier C (mid local 14B-32B), Tier D (GPU server). 100% offline-safe with automatic graceful degradation to Tier A.
2. **AI-2 (Assist-First)**: AI drafts and suggests, never mutates directly. Consequential actions route through the **Approval Broker** creating `ApprovalTask` / `AuditLog` rows (`initiator: AI (model, requestId)`, `approver: <seat>`).
3. **AI-3 (Seat Context & Scope)**: `seatContext(user, unit, action)` computes identity, active seats, effective perms after scope trim, reporting chain, and workload snapshot. Data offered to models is pre-trimmed by scope.
4. **Principle 7 (Deterministic Fusion)**: Numbers (costs, margins, OEE, balances, SLA remaining) always come from pure deterministic engines, never hallucinated by LLMs.

### In scope
1. **Seat Context & Scope Trimmer (`src/lib/copilot/seatContext.ts`)**:
   - Assembles `SeatContextBundle` (identity, language EN/TE/HI, terminal context, active seats, effective level rank, effective scope, acting coverage, reporting chain, plant context, and approval workload).
   - `trimDataByScope`: Pure scope trimmer (`SELF`, `TEAM`, `UNIT`, `PLANT`, `ALL`) running before any data reaches an LLM.
   - `canInvokeTool`: Permission and minimum level rank authorization gate.
2. **Task Router & Hardware Tiering (`src/lib/copilot/taskRouter.ts`)**:
   - Hardware tier hierarchy (`TIER_A` -> `TIER_B` -> `TIER_C` -> `TIER_D`).
   - Task catalog with minimum tier requirements and fallback templates.
   - Automatic graceful degradation to Tier A with notification banner when model is offline or insufficient.
   - Multilingual system prompt generator with JSON seat facts injection.
   - Sliding-window rate limiter.
3. **Tool Registry (`src/lib/copilot/toolRegistry.ts`)**:
   - Authoritative catalog of Copilot tools (`summarizeRecord`, `explainReadiness`, `draft8D`, `draftNcr`, `draftComplaintReply`, `draftIncidentNarrative`, `prepareApproval`, `proposeOverride`, `proposeRecordEdit`).
   - Pure explainers and draft builders with G-3 evidence enforcement.
4. **Approval Broker & Guardrails Engine (`src/lib/copilot/approvalBroker.ts`)**:
   - Guardrails G-1 to G-6 enforcement:
     - G-1: AS9102 FAI required indicator cannot be bypassed.
     - G-2: Quality hold points cannot be signed off by AI.
     - G-3: 8D D8 closure blocked without complete D4–D7 evidence.
     - G-4: Calibration validity gate.
     - G-5: ECO effectivity gate.
     - G-6: Separation of duties / Tree of trust (proposer cannot self-approve).
   - In-tx audit payload formatter (`initiator: AI (model, requestId)`, `approver: <seat>`).
5. **Deterministic Fusion (`src/lib/copilot/fusion.ts`)**:
   - Principle 7 pure engine locking all costs, margins, OEE, balances, and SLA hours to engine outputs.
   - Detects and overrides hallucinated numbers with authoritative engine data.
6. **Typed Transaction Adapters (`src/lib/copilot/copilotTx.ts`)**:
   - `getSeatContextBundleTx`: Assembles live bundle from Prisma relations.
   - `submitAiProposalTx`: Creates `ApprovalTask` with in-tx `AuditLog` (`AI_PROPOSAL_CREATED`).
   - `decideAiProposalTx`: Enforces G-6, updates proposal, and logs in-tx `AuditLog` (`AI_PROPOSAL_ACCEPTED` or `AI_PROPOSAL_REJECTED`).
   - `getPendingProposalsTx`: Scoped query of pending proposals.
   - `executeCopilotTaskTx`: Complete task dispatch lifecycle.
7. **API Route Handlers (`src/app/api/v2/copilot/*`)**:
   - `GET /api/v2/copilot/seat-context`
   - `POST /api/v2/copilot/chat`
   - `GET /api/v2/copilot/proposals`
   - `POST /api/v2/copilot/proposals/[id]/action`
8. **Test Suites**:
   - Unit: `tests/copilotSeatContext.test.ts`, `tests/copilotTaskRouter.test.ts`, `tests/copilotApprovalBroker.test.ts`, `tests/copilotFusion.test.ts`.
   - Real-DB Smoke: `scripts/v2-smoke-copilot.mjs` (`npm run test:c11-11`).

## Definition of Done Verification
- **Unit Tests**: 637/637 PASS across 28 suites (17 new copilot tests).
- **TypeScript**: `tsc --noEmit` exited 0 (0 errors).
- **Zero `as any` Casts**: 0 in `src/lib/copilot/` and `src/app/api/v2/copilot/`.
- **Real-DB Smoke**: `npm run test:c11-11` — 11/11 PASS on `mfgmax_v2_test`.
- **Census**: 274 pages, 378 API routes, 214 models, 106 enums (verified via `verify-counts.mjs`).
