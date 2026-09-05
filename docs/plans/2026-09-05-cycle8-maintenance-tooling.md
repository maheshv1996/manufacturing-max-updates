# Cycle 8 — Maintenance, Tooling & Calibration Plan

> **For the executing agent:** Work on branch `v2`. TDD every task: failing test first (RED evidence) → minimal implementation (GREEN) → refactor. verification-before-completion: run the command, read the output, then claim.

**Goal (master plan C8):** Rebuild the maintenance & tooling **state core** from DEPTH_03 F9, DEPTH_04 W11 — retiring the primary risk: **cal/tool-life gates** (G-4: no expired instrument measuring; worn tool never touches a part). Pure engines first, then typed adapter + `/api/v2/maintenance/*` routes with a real-DB smoke.

**Status (2026-09-05): COMPLETE — C8-8 verification gate passed.**

**Evidence:**
- **Engines TDD (57 tests):** `jobState` (9: OPEN→IN_PROGRESS→CLOSED; CLOSE requires laborHours; BREAKDOWN requires rootCause; **P28 — >60 min breakdowns require countermeasure**; CLOSED terminal) · `pm` (8: calendar + run-hour triggers, never-done ⇒ due, inactive off, both-fire precedence) · `toolLife` (14: consume→IN_USE→NEEDS_REGRIND at rated life; REGRIND only from NEEDS_REGRIND, resets + counts; regrinds ≥ max ⇒ SCRAP_REQUIRED; scrap terminal; cycle-Tool warn/retire/refuse) · `calibration` (10: OK/EXPIRING_SOON(30d)/EXPIRED; expired ⇒ effective QUARANTINE; **G-4 canMeasure/canIssue refuse EXPIRED/RETIRED/QUARANTINED/ALREADY_ISSUED**; O(1) next-due; recalibrate refuses RETIRED) · `spares` (9: issue decrements, no silent negatives, reorder flag + suggested qty, kit shortfall listing) · `permit` (7: 3-leg approval each reason-mandatory, APPROVED only when all three, void with reason, validity window).
- **Adapter + routes:** `src/lib/maintenance/maintenanceTx.ts` (createJob, transitionJobTx, createPmRuleTx, scanPmRulesTx, completePmRuleTx, maintenanceToolActionTx, recordToolCyclesTx, instrumentActionTx, issueSpareToJobTx, issueKitToJobTx, createPermitTx, permitActionTx — all engine-first, in-tx audits, engine codes → typed VALIDATION). `src/app/api/v2/maintenance/*` — jobs, jobs/[id]/action, pm-rules, pm-rules/scan (SCAN | SCAN_AND_CREATE | complete rule), maintenance-tools/[id]/action, instruments/[id]/action, spares/issue, permits, permits/[id]/action (**per-leg route authz: EHS→ehs.approve, MAINTENANCE→maintenance.edit, PRODUCTION→ops.edit; void→maintenance.edit|ehs.approve**). PM run-hours computed from RUNNING telemetry spans since last done.
- **Real-DB smoke `npm run test:c8-8` (CI-wired): 15/15 green** on `mfgmax_v2_test` — BREAKDOWN job start/close with FINDINGS_REQUIRED + ROOT_CAUSE_REQUIRED + RCA-close persistence; PM calendar scan + SCAN_AND_CREATE (one job only, no re-scan duplicate), run-hour trigger via RUNNING telemetry; tool consume→regrind×3→SCRAP_REQUIRED→SCRAP with 7 ToolLifeLog rows; cycle tool WARNING→RETIRED→refused; instrument EXPIRED-issue blocked (G-4)→recalibrate→issue→double-issue blocked→return; spare over-issue blocked + reorder flag; kit all-or-nothing + KIT_SHORTFALL; permit EHS→MAINT→PROD→APPROVED (columns persist)→VOID; 16 audit types verified.
- **Gate:** `tsc --noEmit` exit 0 · `npm test` **569/569 across 28 suites** · `as any` scan clean over `src/lib/maintenance` + `src/app/api/v2/maintenance` · MEMORY counts synced (357 API routes).

---

## 1. Existing assets

| Asset | Status | Action |
|---|---|---|
| `src/lib/calibration.ts` (v1) | ✅ pure (status/effectiveLocation/nextCalibrationDue) | Seed semantics into `src/lib/maintenance/calibration.ts`; v2 adds issue-flow gates + tests |
| `src/lib/fixtureGate.ts` (v1) | ⚠️ prisma-coupled, `any` | Later cycle (fixture gate belongs to W2 start gate); out of scope here |
| `MaintenanceJob`, `PMRule`, `MaintenanceTool`, `ToolLifeLog`, `Tool`, `CalibratedTool`, `InstrumentIssue`, `SparePart`, `SpareKit(Item)`, `PermitToWork`, `Fixture` | ✅ v2 schema | Reuse as-is; no schema change required this cycle |

## 2. Scope (in)

- **Job state machine:** OPEN → IN_PROGRESS → CLOSED; CLOSE requires findings (laborHours); BREAKDOWN closure requires rootCause; breakdowns > 60 min additionally require countermeasure (P28); CLOSED terminal.
- **PM due engine:** calendar (`intervalDays` from `lastDoneAt`) and run-hour (`intervalRunHours` vs run-hours-since-last supplied by the caller) triggers; never-done ⇒ due; kit auto-attach data.
- **Tool life:** `MaintenanceTool` — consume → NEEDS_REGRIND at rated life; REGRIND resets + counts regrinds; regrinds ≥ max ⇒ SCRAP mandatory; wear %. `Tool` (cycles) — warn at threshold, RETIRE at max life; retired rejects cycles.
- **Calibration (G-4):** status derivation (30-day warning), expired ⇒ quarantined effectively; measurement/issue refused when EXPIRED or RETIRED; issue requires future expected-return; O(1) next-due math.
- **Spares & kits:** issue to job with no silent negatives; reorder flag at min/reorder-point; kit availability shortfall check for PM jobs.
- **Permit to work:** PENDING → APPROVED (requires EHS + maintenance + production legs, each with reason) | VOID (reason); validity window enforcement.
- **Typed adapter + routes + real-DB smoke.**

### Out of scope (later cycles)
Fixture gate (W2 start-gate integration), MTBF/MTTR analytics, vibration/RUL predictive records, cal-lab requisition flow (F3 surface), auto-reorder PO creation.

## 3. Tasks

- **C8-1** `src/lib/maintenance/jobState.ts` + tests (~8)
- **C8-2** `src/lib/maintenance/pm.ts` + tests (~6)
- **C8-3** `src/lib/maintenance/toolLife.ts` + tests (~10)
- **C8-4** `src/lib/maintenance/calibration.ts` + tests (~8)
- **C8-5** `src/lib/maintenance/spares.ts` + tests (~7)
- **C8-6** `src/lib/maintenance/permit.ts` + tests (~7)
- **C8-7** `src/lib/maintenance/maintenanceTx.ts` + routes: `jobs`, `jobs/[id]/action`, `pm-rules`, `pm-rules/scan`, `maintenance-tools/[id]/action`, `instruments/[id]/action`, `spares/issue`, `permits`, `permits/[id]/action` (authz `maintenance.edit`; EHS permit leg `ehs.approve`)
- **C8-8** Gate: tsc + full suite + cast scan; smoke `scripts/v2-smoke-maintenance.mjs` (`npm run test:c8-8`, CI-wired); docs (plan COMPLETE, DEPTH F9/W11 cross-refs, HANDOVER, WORK_LOG)

## 4. Verification commands

```bash
npm test
npx tsc --noEmit
grep -rn "as any" src/lib/maintenance src/app/api/v2/maintenance || echo clean
npm run test:c8-8
```

---

*C8-1…C8-8 executed and verified; boundaries held — fixture gate (W2 start gate), cal-lab requisition flow, MTBF/MTTR analytics, predictive RUL are future cycles.*
