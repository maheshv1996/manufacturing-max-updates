# Manufacturing Max — Handover

**Branch:** `master` (All 13 Rebuild Cycles Merged & Tagged `v2.0.0`)
**Last Updated:** 2026-09-05
**Release Tag:** `v2.0.0`

## Run
```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev          # http://localhost:3000
```

## v2 Patterns (must follow)
- Pure engines in `src/lib/*` — no DB calls inside engine files
- Typed `Result<T,E>` from `src/lib/core/result.ts`
- `AppError` envelope with `code`, `message`, `details`
- Zod validation at API edges via `parseOr400`
- Prisma `$transaction` for all mutations
- `buildAuditEvent` + in-tx `auditLog.create`
- `runIdempotent` + `IdempotencyKey` for client-supplied dedupe
- Money in **integer paise** end-to-end (`toPaise` / `fromPaise` / `formatRupees`)
- Enum mapping helpers because **Prisma schema enums differ from engine enums**:
  - `SalesOrderStatus`: DB = `DRAFT/CONFIRMED/IN_PRODUCTION/PARTIALLY_DISPATCHED/DISPATCHED/INVOICED/CANCELLED`; engine = `DRAFT/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED`
  - `InvoiceStatus`: DB = `UNPAID/PARTIAL/PAID`; engine = `DRAFT/SENT/PARTIAL/PAID/OVERDUE`
  - `Payment` model has **no `status` field**; payment status is returned in adapter response only

## Completed Cycles
| Cycle | Module | Status |
|-------|--------|--------|
| C1 | Typed Core + Org Model | Done |
| C2 | Shop Floor / MES | Done |
| C3 | Quality / Compliance | Done |
| C4 | Change Control / ECO | Done |
| C5 | Supply Chain / Inventory / Purchasing | Done |
| C6 | Commercial & Finance Core | **Done** |
| C7 | People & Payroll Core | **Done** |
| C8 | Maintenance, Tooling & Calibration | **Done** |
| C9 | EHS, Lean & Continuous Improvement | **Done** |
| C10 | Reports, Digest & Print Center | **Done** |
| C11 | AI Copilot Framework | **Done** |
| C12 | System, Admin & Config (Custom Entities, Org-Chart, Terminology) | **Done** |
| C13 | Plant-Server Scale, Desktop Integration & Go-Live Hardening | **Done** |

## C13 Current State (2026-09-05) — COMPLETE (MASTER REBUILD 100% COMPLETE)

- **Engines (TDD, 4 tests):**
  - `src/lib/scale/concurrencyBenchmark.ts`: Pure scale evaluation engine for simulating high-concurrency plant-server workloads (500+ users), exact linear percentile interpolation (`min`, `max`, `avg`, `p50`, `p90`, `p95`, `p99`), throughput measurement (`ops/sec`), and SLA threshold evaluation.
- **Desktop Platform Hardening:**
  - `desktop/launcher.js`: Standalone server orchestration, environment bindings (`DB_POOL_MAX`, `PLANT_TZ`, `AI_TIER_DEFAULT`), and embedded Postgres watchdog.
  - `desktop/lib/vault.js`: Backup rotation (keep 30), filename generation, disaster recovery simulation.
  - `desktop/lib/license.js`: Machine fingerprinting and 14-day grace activation state machine (`evaluateActivation`).
- **Verification:**
  - Unit tests: **654/654 pass across 32 suites** (4 new C13 benchmark tests).
  - Real-DB smoke: `scripts/v2-smoke-scale-desktop.mjs` (`npm run test:c13-13`) — **6/6 PASS** on `mfgmax_v2_test`.
  - Benchmarks: **1,041+ ops/sec** read throughput (p50: 4ms, p95: 74ms), **789+ ops/sec** transactional write burst (p50: 5.5ms, p95: 12.5ms). Zero deadlocks.
  - G-9 Idempotency race test: 5 concurrent requests with identical client ID yielded exactly 1 execution and 4 deduplicated skips with cached response.
  - TypeScript: `tsc --noEmit` exit 0 (0 errors), zero `as any` casts. Census: 274 pages, 387 API routes, 214 models, 106 enums.

## C12 Current State (2026-09-05) — COMPLETE

- **Engines (TDD, 13 tests across 3 suites):**
  - `src/lib/custom/customEngine.ts`: Dynamic JSON record validation against user-defined field definitions (`text`, `number`, `date`, `select`, `boolean`), required field checks, options membership, and safe slug generation.
  - `src/lib/org/reportingLineEngine.ts`: Pure DAG cycle detection preventing direct loops (A -> B -> A), indirect multi-hop loops (A -> B -> C -> A), and self-reporting (A -> A); active window resolution; nested org hierarchy tree builder.
  - `src/lib/system/terminologyEngine.ts`: Configurable terminology mapping with safe fallback to canonical manufacturing terms and dictionary validation.
- **Adapters:**
  - `src/lib/custom/customTx.ts`: `createCustomEntityTx`, `updateCustomEntityTx`, `createCustomRecordTx`, `updateCustomRecordTx`, `deleteCustomRecordTx`, `getCustomEntitiesTx`, `getCustomRecordsTx` with single `$transaction` mutations and in-tx `AuditLog` rows.
  - `src/lib/org/reportingLineTx.ts`: `createReportingLineTx` (with pre-commit DAG cycle detection), `terminateReportingLineTx`, `getReportingLinesTx`, `getOrgChartHierarchyTx`.
  - `src/lib/system/settingsTx.ts`: `getTerminologyMapTx`, `updateTerminologyMapTx`, `getSystemConstantsTx`, `updateSystemConstantsTx`.
- **Routes:**
  - `/api/v2/custom/entities` (GET, POST) & `/api/v2/custom/entities/[id]` (GET, PATCH)
  - `/api/v2/custom/records` (GET, POST) & `/api/v2/custom/records/[id]` (GET, PATCH, DELETE)
  - `/api/v2/org/reporting-lines` (GET, POST) & `/api/v2/org/reporting-lines/[id]` (DELETE)
  - `/api/v2/org/chart` (GET)
  - `/api/v2/system/terminology` (GET, PUT)
  - `/api/v2/system/constants` (GET, PUT)
- **Verification:**
  - Unit tests: **650/650 pass across 31 suites** (13 new C12 tests).
  - Real-DB smoke: `scripts/v2-smoke-system-admin.mjs` (`npm run test:c12-12`) — **12/12 PASS** on `mfgmax_v2_test`.
  - Zero `as any` casts, strict TypeScript compilation (0 errors), census synced (387 API routes).

## C11 Current State (2026-09-05) — COMPLETE

- **Engines (TDD, 17 tests across 4 suites):**
  - `src/lib/copilot/seatContext.ts`: Assembles `SeatContextBundle` (identity, preferred language EN/TE/HI, terminal context, active seats, effective level rank, effective scope, acting coverage, reporting chain, plant context, and approval workload). Pure scope trimmer (`SELF`, `TEAM`, `UNIT`, `PLANT`, `ALL`) running before any data reaches model contexts. Permission and level gating for tool invocations.
  - `src/lib/copilot/taskRouter.ts`: Hardware tiering (`TIER_A` -> `TIER_B` -> `TIER_C` -> `TIER_D`), task catalog with minimum tier requirements and fallback templates, automatic graceful degradation to Tier A with notification banner, multilingual prompt generation, and sliding-window rate limiter.
  - `src/lib/copilot/toolRegistry.ts`: Authoritative tool catalog (`summarizeRecord`, `explainReadiness`, `draft8D`, `draftNcr`, `draftComplaintReply`, `draftIncidentNarrative`, `prepareApproval`, `proposeOverride`, `proposeRecordEdit`) and pure explainers/draft builders.
  - `src/lib/copilot/approvalBroker.ts`: Guardrail enforcement G-1 to G-6 (FAI required, quality hold point signoff, 8D D8 closure evidence, calibration validity, ECO effectivity, and separation of duties / self-approval blockage). Formats in-tx audit payload with AI initiator and human approver.
  - `src/lib/copilot/fusion.ts`: Principle 7 pure deterministic fusion locking all costs, margins, OEE %, balances, and SLA hours to engine outputs; detects and overrides hallucinated numbers with authoritative engine data.
- **Adapters:**
  - `src/lib/copilot/copilotTx.ts`: `getSeatContextBundleTx`, `submitAiProposalTx`, `decideAiProposalTx`, `getPendingProposalsTx`, `executeCopilotTaskTx` (with in-tx `AuditLog` for proposals and decisions).
- **Routes:**
  - `/api/v2/copilot/seat-context`
  - `/api/v2/copilot/chat`
  - `/api/v2/copilot/proposals`
  - `/api/v2/copilot/proposals/[id]/action`
- **Verification:**
  - Unit tests: **637/637 pass across 28 suites** (17 new copilot tests).
  - Real-DB smoke: `scripts/v2-smoke-copilot.mjs` (`npm run test:c11-11`) — **11/11 PASS** on `mfgmax_v2_test`.
  - TypeScript: `tsc --noEmit` exit 0, zero `as any` casts.
  - Census: synchronized to 378 API routes (`scripts/verify-counts.mjs` passes).

## Next Up
- **C12: System, Admin & Config UI (Custom entities, org-chart/approval-chain admin)** per `DEPTH_02 §7`.

- **Engines (TDD, 17 tests across 5 suites):**
  - `src/lib/ehs/safety.ts`: Safety incident machine (`OPEN → IN_INVESTIGATION → CLOSED`), F10 closure evidence guard (`rootCause` or `fiveWhyReason` AND `actionTaken`), P27 near-miss observation quota engine.
  - `src/lib/lean/projects.ts`: DMAIC project machine (`DEFINE → MEASURE → ANALYZE → IMPROVE → CONTROL`), reversible hold/resume, F11 completion evidence (`rootCause` present AND all action items `DONE`).
  - `src/lib/lean/fiveS.ts`: 5S audit scoring formula `round1(Σ / (items × 5) × 100)`.
  - `src/lib/lean/ideas.ts`: Idea pipeline (`SUBMITTED → IN_REVIEW → IMPLEMENTED`), additive upvote counter.
- **Adapters:**
  - `src/lib/ehs/ehsTx.ts`: `reportIncidentTx`, `incidentActionTx`, `nearMissQuotaTx`.
  - `src/lib/lean/leanTx.ts`: `createProjectTx`, `projectActionTx`, `recordRcaTx`, `addActionItemTx`, `markActionItemDoneTx`, `recordFiveSAuditTx`, `submitIdeaTx`, `upvoteIdeaTx`, `transitionIdeaTx`.
- **Routes:**
  - `/api/v2/ehs/{incidents,incidents/[id]/action,quota}`
  - `/api/v2/lean/{projects,projects/[id]/action,projects/[id]/rca,projects/[id]/action-items,five-s,ideas,ideas/[id]/action}`
- **Verification:**
  - Unit tests: **608/608 pass across 24 suites**.
  - Real-DB smoke: `scripts/v2-smoke-ehs-lean.mjs` (`npm run test:c9-9`) — **20/20 PASS** on `mfgmax_v2_test`.
  - TypeScript: `tsc --noEmit` exit 0, zero `as any` casts.
  - Census: synchronized to 369 API routes (`scripts/verify-counts.mjs` passes).

### Completed
- Fixed 3 pre-existing TS errors in C6 engine files
- `npm test` passes: **479/479**
- C6-5 typed transaction adapters created:
  - `src/lib/commercial/commercialTx.ts` — quotation, SO, dispatch, invoice, payment adapters
  - `src/lib/finance/financeTx.ts` — journal posting, reversal, treasury, fixed assets
- `/api/v2/commercial` routes:
  - `quotations` (create)
  - `quotations/[id]/action` (transition)
  - `sales-orders` (create)
  - `sales-orders/[id]/action` (transition)
  - `invoices` (create)
  - `invoices/[id]/action` (transition)
  - `payments` (create)
- `/api/v2/finance` routes:
  - `journal-entries` (post)
  - `journal-entries/[id]/action` (reverse)

### TS Errors Fixed This Session
- Removed unused `toPaise` in `src/lib/commercial/invoices.ts`
- Added optional `name?: string` to `GlAccountLike` in `src/lib/finance/trialBalance.ts`
- Removed unused `DepreciationScheduleRow` import in `tests/financeFixedAssets.test.ts`
- `commercialTx.ts`: removed unused `Prisma` import → changed to `import type { PrismaClient, Prisma } from "@prisma/client"`
- `commercialTx.ts`: removed unused `PaymentStatus` import
- `commercialTx.ts`: removed unused `DispatchAction` import (dispatch module not yet wired)
- `financeTx.ts`: made `period` optional in `PostJournalEntryInput`
- `financeTx.ts`: removed unused `FixedAssetInput` import
- `commercialTx.ts`: replaced remaining `as any` casts with typed `Prisma.SalesOrderStatus` and `Prisma.InvoiceStatus`

### C6-6 Verification Gate (2026-09-05)
- **Adapter smoke test** (`npm run test:c6-6`): **11/11 pass**
- **HTTP smoke test** (`npm run test:c6-6:http`): **10/10 pass** against `mfgmax_v2_test`
- **`as any` scan**: clean across `src/lib/commercial`, `src/lib/finance`, `src/app/api/v2/commercial`, `src/app/api/v2/finance`
- **`reconcileBankTx`**: implemented as pure function returning `ReconcileResult` without persisting `GstReconRun` (Option C)

## Next Steps
1. **C7 planning** — C6 verification passed; ready to plan C7.
2. **Wire remaining C6-5 adapters** — dispatch transition, payment transition routes not yet exposed (non-blocking).
3. **C6-6 scripts in CI** — `npm run test:c6-6` and `npm run test:c6-6:http` added to `package.json` `ci` script.

## C7 Current State (2026-09-05) — COMPLETE

- Engines (TDD): `src/lib/people/{employees,attendance,leaves,payroll}.ts` + `src/lib/sessionRotation.ts` — suite **512/512 across 26 suites**, tsc clean, cast-free.
- Schema: `LeaveStatus` += `CANCELLED`; `LeaveType` += `MATERNITY|PATERNITY|COMP_OFF`.
- Adapter + routes: `src/lib/people/peopleTx.ts`; `/api/v2/people/{employees,attendance,leaves,leaves/[id]/action,payroll,payroll/[month]/run}`.
- Smoke: `npm run test:c7-6` (CI-wired) — 14/14 on `mfgmax_v2_test` (employee→attendance→leave→payroll→audits→session-rotation).

### Boundaries
- Session rotation is additive; existing auth flows unaffected.
- v1 people pages (`src/app/people/`) are retired after parity review, not deleted until parity review happens.

## C8 Current State (2026-09-05) — COMPLETE

- Engines (TDD, 57 tests): `src/lib/maintenance/{jobState,pm,toolLife,calibration,spares,permit}.ts` — suite **569/569 across 28 suites**, tsc clean, cast-free.
- Adapter: `src/lib/maintenance/maintenanceTx.ts` (engine-gated, in-tx audits).
- Routes: `/api/v2/maintenance/{jobs,jobs/[id]/action,pm-rules,pm-rules/scan,maintenance-tools/[id]/action,instruments/[id]/action,spares/issue,permits,permits/[id]/action}` — PM run-hours from RUNNING telemetry; per-leg permit authz (EHS→ehs.approve).
- Smoke: `npm run test:c8-8` (CI-wired) — 15/15 on `mfgmax_v2_test`.
- Guards landed: P28 RCA+countermeasure on >60min breakdowns; G-4 expired-instrument refusal; max-regrind mandatory replace; no silent negative spare stock; 3-leg permit approval.

## C8-9 Completion (2026-09-05) — COMPLETE

Closed the three workflow-critical gaps found by the C8 completeness audit (plan: `docs/plans/2026-09-05-cycle8-completion.md`):

- **C8-9a Tool wear on LOG_GOOD (W11):** pure `productionWear.projectProductionToolWear` → `maintenanceTx.applyProductionToolWearInTx`, wired into `shopfloor/applyJobAction.ts` LOG_GOOD. Cycle tools warn→RETIRED via the v2 engine (parity change vs v1 `MAINTENANCE`); unit tools auto-consume to NEEDS_REGRIND with a single `ToolLifeLog` CONSUME row **only on the state crossing** (no per-LOG_GOOD alert spam). RETIRED/SCRAPPED tooling never re-arms.
- **C8-9b G-4 at measurement time:** pure `inspectionGate` → `qualityTx.createInspectionTx` refuses expired/quarantined/retired gauges (`calibratedToolId` path) and validates passed+failed ≤ total; route `POST /api/v2/quality/inspections`.
- **C8-9c Breakdown auto-scan (W11 Andon):** pure `breakdownScan` → `maintenanceTx.scanBreakdownsTx`; route `POST /api/v2/maintenance/breakdowns/scan` with `mode=SCAN|SCAN_AND_CREATE` and `cooldownMinutes` re-open guard. FAULT machine with no open BREAKDOWN → candidate; one job per machine; open job or cooldown suppresses.
- Verification: suite **535/535 / 24 suites**; tsc 0 errors; cast-free; real-DB smoke **20/20** (`test:c8-8` extended with the three lifecycle blocks + audits incl. `MACHINE:TOOL_WEAR`, `MaintenanceJob:BREAKDOWN_AUTO_CREATED`, `QualityInspection:INSPECTION_CREATED`).
- Still deferred (unchanged): predictive RUL engine, MTBF/MTTR analytics, spare auto-reorder POs, cal-recall scope, v2 React UI for `/maintenance/*`.

## Key Files
- `docs/plans/2026-09-05-cycle7-people-payroll.md` — C7 task breakdown
- `src/lib/commercial/commercialTx.ts` — C6-5 commercial adapters
- `src/lib/finance/financeTx.ts` — C6-5 finance adapters
- `prisma/schema.prisma` — source of truth for DB enums and models
- `src/lib/commercial/salesOrders.ts` — engine `SalesOrderStatus` = `DRAFT|CONFIRMED|IN_PROGRESS|COMPLETED|CANCELLED`
- `src/lib/commercial/invoices.ts` — engine `InvoiceStatus` = `DRAFT|SENT|PARTIAL|PAID|OVERDUE`
- `src/lib/finance/glPosting.ts` — engine `JournalLine` type
