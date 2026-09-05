# Cycle 8 Follow-up — C8-9 Workflow-Critical Gap Closure (Maintenance & Tooling)

> **Status: COMPLETE — 2026-09-05. All gates green.**
> Triggered by a completeness audit of C8 (which passed its own C8-8 gate: 57 engine tests,
> clean tsc, 0 `as any`, 9 routes, 15/15 real-DB smoke) against the DEPTH_03 F9 / DEPTH_04 W11
> anchor. The audit found the **state core** shipped but three workflow-critical integrations
> missing. This plan closes those three. Predictive RUL / MTBF-MTTR remain explicitly deferred
> (DEPTH_03 F9 lists them as roadmap; the C8 plan scoped them out).
>
> **Verified end state (executed, not assumed):**
> - `tests/*.test.ts` — **535/535 pass, 24 suites** (was 513; +22 from C8-9 TDD suites)
> - `tsc --noEmit` — **0 errors**; `as any` scan over touched dirs — **0 hits**
> - `npm run test:c8-8` real-DB smoke — **20/20 pass** (was 15; +5 C8-9 lifecycle blocks incl.
>   crossing-once semantics, G-4 refusal at measurement, FAULT→scan→create→suppress→cooldown)
> - Engine fix during review: `crossedThreshold` fires **only on the state crossing** (a tool
>   already NEEDS_REGRIND keeps consuming but never re-fires the CONSUME alert).

## Gaps being closed

| # | Gap (from audit) | Anchor | Deliverable |
|---|---|---|---|
| C8-9a | Tool life is **not decremented on LOG_GOOD** in the v2 shopfloor path (`applyJobAction.ts` never touches `Tool`/`MaintenanceTool`; v1 did via `incrementAssignedToolCyclesTx`/`incrementMaintenanceToolUnitsTx`) | W11 "Tool life: cycle decrements on LOG_GOOD → wear % → warn → mandatory replace" | Pure `projectProductionToolWear` + typed in-tx applier `applyProductionToolWearInTx` wired into the LOG_GOOD case |
| C8-9b | G-4 `canMeasure` is only enforced at **crib issue**, never at **measurement entry** | G-4 "no expired instrument measuring"; W11 cal recall | Pure `assertInstrumentUsable` + `createInspectionTx` (QualityInspection.calibratedToolId gated) + `POST /api/v2/quality/inspections` |
| C8-9c | No **machine DOWN/FAULT → BREAKDOWN job auto-creation** | W11 "breakdowns create jobs from machine DOWN events (Andon)" | Pure `detectBreakdownMachines` + `scanBreakdownsTx` + `POST /api/v2/maintenance/breakdowns/scan` |

## Explicitly deferred (already documented in DEPTH/plans; NOT regressed here)
- `predictive.ts` RUL engine + `PredictiveModelRun` routes (DEPTH_03 F9 roadmap)
- MTBF/MTTR reliability engine (`ReliabilityMetric` analytics; `.kilo` roadmap slice)
- Auto-reorder PO creation at spare reorder point (C8 plan out-of-scope)
- Cal-recall scope (re-inspect parts measured since last cal) — depends on W5 inspection coverage
- v2 React UI for `/maintenance/*` (current surfaces drive v1 APIs; staged for a later cycle)

## Design notes (re-spec deltas vs v1, recorded before review)
- **Tool cycles:** v1 flipped a worn tool to `MAINTENANCE` at ≥100%; the C8 engine (`recordCycles`)
  is canonical in v2 and RETIRES at max life. Auto-decrement uses the v2 engine.
- **MaintenanceTool units:** v1 only incremented `usedUnits` with no lifecycle effect; v2 auto-consume
  runs the engine, so crossing `ratedLifeUnits` flips `NEEDS_REGRIND` (mandatory replace path) and a
  `ToolLifeLog` row (action `CONSUME`, `woId` set) records the event. SCRAPPED/RETIRED tools are skipped.
- **Breakdown scan:** a machine whose `currentState` is `FAULT` (IoT Andon) with no `OPEN`/`IN_PROGRESS`
  BREAKDOWN job is a candidate; the adapter creates one job per machine with an optional
  `cooldownMinutes` re-open guard (default 0).

## Tasks (TDD: RED → GREEN, verification output in-turn)
1. **C8-9a** `src/lib/maintenance/productionWear.ts` (+`tests/maintenanceProductionToolWear.test.ts`)
   → `maintenanceTx.applyProductionToolWearInTx` → hook LOG_GOOD in `applyJobAction.ts`
2. **C8-9b** `src/lib/quality/inspectionGate.ts` (+`tests/qualityInspectionGate.test.ts`)
   → `qualityTx.createInspectionTx` → `POST /api/v2/quality/inspections`
3. **C8-9c** `src/lib/maintenance/breakdownScan.ts` (+`tests/breakdownScan.test.ts`)
   → `maintenanceTx.scanBreakdownsTx` → `POST /api/v2/maintenance/breakdowns/scan`
4. Extend `scripts/v2-smoke-maintenance.mjs` with the three lifecycle blocks (run-scoped, re-runnable)
5. Gate: `tests/*.test.ts` full suite + `tsc --noEmit` + `as any` scan over touched dirs
6. Docs: mark plan COMPLETE, DEPTH_03 F9, DEPTH_04 W11, HANDOVER, WORK_LOG, MEMORY

## Verification commands
```bash
node --import tsx --test tests/maintenanceProductionToolWear.test.ts tests/qualityInspectionGate.test.ts tests/breakdownScan.test.ts
npm test            # via `node --import tsx --test tests/*.test.ts`
node node_modules/typescript/lib/tsc.js --noEmit
npm run test:c8-8   # extended real-DB smoke (requires local Postgres mfgmax_v2_test)
```