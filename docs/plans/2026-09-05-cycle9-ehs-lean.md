# Cycle 9 — EHS, Lean & Continuous Improvement (C9)

**Branch:** `v2` · **Date:** 2026-09-05 · **Status:** COMPLETE
**Spec anchor:** DEPTH_03 F10 (EHS) / F11 (Lean & CI) · kilo roadmap C9
**Primary risks:** incident closure evidence, near-miss quota enforcement, project completion evidence

## Scope

Typed-core rebuild of the EHS + Lean state machines on the C1 org spine, following v2 law
(pure engines DB-free → `*Tx` adapters → zod routes; audits + idempotency; no casts).

### In scope
1. **Safety incident machine** (`SafetyIncident`, string-typed in schema):
   `OPEN → IN_INVESTIGATION → CLOSED`.
   - Report: validates `type` (NEAR_MISS|HAZARD|PPE_VIOLATION|INCIDENT), `severity`
     (LOW|MEDIUM|HIGH|CRITICAL), location + description mandatory.
   - START_INVESTIGATION: requires `capaOwner` (accountability before work).
   - **CLOSE (F10 guardrail — closure evidence):** requires `rootCause` **or** `fiveWhyReason`
     **and** `actionTaken`; sets `closedAt`/`closedBy`. No delete path anywhere (audit-only).
2. **P27 near-miss quota** (pure engine): managers (level MANAGER, active) vs count of
   NEAR_MISS/HAZARD/PPE_VIOLATION reported this month by `reportedBy`; quota from Setting
   `ehsObservationQuota` (default 4); rows `{name, count, quota, missed}`.
3. **Improvement project machine** (`ImprovementProject` + 1:1 `RcaRecord` + `ActionItem[]`):
   - Phase advance strictly sequential DEFINE→MEASURE→ANALYZE→IMPROVE→CONTROL.
   - Status: OPEN→IN_PROGRESS→COMPLETED | ON_HOLD (hold/in-progress reversible).
   - **COMPLETED (F11 guardrail — completion evidence):** RCA `rootCause` present AND all
     action items DONE. Sets `completedAt`.
4. **5S audits:** scores 0–5 per item (v1 parity), `totalPct = round1(Σ/(items×5)×100)`;
   unique (audit,item) rows.
5. **Idea pipeline:** SUBMITTED→IN_REVIEW→IMPLEMENTED + upvote (`votes += 1`).

### Out of scope (documented deferrals)
PPE/extinguisher/haz-waste/consent registers (v1 DynamicRegister surfaces remain live),
safety training records, C9 UI pages (v2 UI cycle later), carbon/environmental engines.

## Deliverables
- Engines: `src/lib/ehs/safety.ts`, `src/lib/lean/projects.ts`, `src/lib/lean/fiveS.ts`,
  `src/lib/lean/ideas.ts` (pure, Result-typed, DB-free)
- Adapters: `src/lib/ehs/ehsTx.ts`, `src/lib/lean/leanTx.ts` ($transaction + audit + idempotent)
- Routes: `/api/v2/ehs/{incidents,incidents/[id]/action,quota}`,
  `/api/v2/lean/{projects,projects/[id]/action,projects/[id]/rca,five-s,ideas,ideas/[id]/action}`
- Tests: `tests/ehsIncident.test.ts`, `tests/ehsQuota.test.ts`, `tests/leanProject.test.ts`,
  `tests/leanFiveS.test.ts`, `tests/leanIdeas.test.ts`
- Smoke: `scripts/v2-smoke-ehs-lean.mjs` → `npm run test:c9-9` (CI-wired)

## Definition of Done
Engines TDD-green → tsc clean → cast-free scan → HTTP smoke green on `mfgmax_v2_test`
→ MEMORY counts synced → HANDOVER + DEPTH notes updated → single C9 gate commit on `v2`.
