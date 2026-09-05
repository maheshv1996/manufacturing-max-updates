# Manufacturing Max — Handover

**Branch:** `v2` (DEPTH_04 typed-core rebuild)
**Last Updated:** 2026-09-05

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

## C6 Current State (2026-09-05)

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
