# Cycle 2 — Shop-Floor MES Core Implementation Plan

> **STATUS: CYCLE COMPLETE — 2026-09-05.** Pure engines (`woState`, `eventLedger`, `readiness`, `routing`, `shiftCount`) + typed adapter (`applyJobAction.ts`) + routes (`/api/v2/shopfloor/{action,readiness}`) all landed on `v2` (uncommitted). Full gate: **80 tests across 14 files, 0 fail** (C1 9 suites + C2 5 suites); `tsc --noEmit` exit 0 whole repo; `as any` scan clean. **Real-DB e2e smoke (user local Postgres, scratch `mfgmax_v2_test`):** fixture gate blocked START_JOB → written override released it (this exposed and fixed a genuine adapter bug: override didn't reach the engine gate); idempotent START/LOG replays skipped (no double-apply); LOG_GOOD/SCRAP counters + ScrapQuarantine; double downtime open rejected; downtime close with duration; short closure blocked then authorized; FAI gate (G-1) blocked LOG_GOOD without APPROVED FAI; final DB asserts (log good=6 scrap=1 closed, WO COMPLETED/IN_PROGRESS, machine states, 36 audit rows). Remaining boundaries: route **HTTP** layer (headers/session) needs a running Next server; certification safety gate, tool-cycle increments, serial capture, and the full material/cert/rev/calibration readiness snapshot join when their owning cycles land.

> **For the executing agent:** Work on branch `v2`. TDD every task: write the failing test → run it (must FAIL) → minimal implementation → run (must PASS) → refactor. verification-before-completion applies: evidence from the command output before any claim.

**Goal (master plan C2):** Rebuild the shop-floor MES **state core** from DEPTH_03 F2 / DEPTH_04 W2 as typed, DB-free, TDD-proven engines — retiring the primary risk: **state-engine correctness and idempotency**. The v1 prototype keeps its 862-line `src/app/api/operator/action/route.ts` (`(tx as any)` state logic, inline fixture gate, per-action idempotency reserve/complete) as the parity reference; nothing there is deleted until the typed engines + adapter pass review.

**Grounded findings (2026-09-05, read from repo):**
- v1 action surface: `START_JOB, LOG_GOOD, LOG_SCRAP, REPORT_DOWNTIME, END_DOWNTIME, SETUP, RUN, CHANGEOVER, COMPLETE_JOB` (operator route `switch`).
- v1 semantics to preserve: START_JOB → WO `IN_PROGRESS` + open `ProductionLog` + machine `RUNNING` (fixture gate blocks, manager override with written reason audited); LOG_GOOD/SCRAP increment counters + tool cycles; COMPLETE_JOB → WO `COMPLETED`; clientTimestamp state-conflict (server authority, 412) + `X-Client-ID` idempotency reserve/complete.
- Enums (real): `WorkOrderStatus PLANNED|IN_PROGRESS|COMPLETED|ON_HOLD`; `MachineState RUNNING|IDLE|SETUP|FAULT|OFF`; `LogStatus DRAFT|FINALIZED`; `DowntimeCategory MECHANICAL|ELECTRICAL|MATERIAL|QUALITY|OPERATOR`. `RoutingStep.isHoldPoint` + `HoldPointSignoff` (PASSED|CONCESSION) exist; `ShiftCount` PENDING→AGREED|DISPUTED→RESOLVED exists. `readinessEngine.ts` covers **materials only** (SHORT/LOW_SAFETY_STOCK) — W2's certs/drawing-rev/fixture/calibration/FAI readiness is the gap C2-3 fills.
- v1 `idempotency.ts` (src/lib) + `src/lib/core/{idempotency,sequence,audit,integrityDb}.ts` (C1) already exist — C2 adapters reuse the C1 typed core, never re-invent.

**Scope (typed engines, DB-free; routes adapt later in-cycle):**
- C2-1 WO status state machine (pure transitions + gate inputs + block codes)
- C2-2 Production/downtime event ledger (pure reducer over run state; counters, no-delete, open-downtime rules)
- C2-3 Readiness engine re-spec (materials + certs + drawing-rev + fixture + calibration + FAI as typed gap list)
- C2-4 Routing/hold-point advance rules (currentSeq blocked at isHoldPoint until signoff)
- C2-5 Shift-count state machine (tolerance → AGREED; dispute → supervisor RESOLVED)
- C2-6 Typed adapter + routes (`/api/v2/shopfloor/*`): engine calls inside `$transaction`, C1 `runIdempotent`, state-conflict check, zod edges, DTOs — **typecheck gate only** (no reachable Postgres in authoring env; DB smoke deferred to user's dev DB)
- C2-7 Machine-state derivation (START_JOB→RUNNING, COMPLETE_JOB→IDLE, SETUP→SETUP, RUN→RUNNING, CHANGEOVER→SETUP) + ledger integration

**Out of scope (later cycles / existing v1 surfaces):** operator terminal UI, andon/IoT/MQTT, serial-unit allocation, SPC, capacity/S&OP, tool-life decrement engine, offlineSync queue UI, kiosk token gate. Engines must leave extension points (typed inputs) for these.

**Verify commands (whole cycle):**
- `node node_modules/typescript/lib/tsc.js --noEmit` (via bundled node shim) — whole-repo type gate
- `bun test` over new suites from a `.env`-free cwd (`cd /tmp`) — RED→GREEN evidence per task
- `grep -rn "as any" src/lib/shopfloor src/app/api/v2/shopfloor` → none

---

### Task C2-1: WO status state machine (pure, TDD)

**Files:** Create `src/lib/shopfloor/woState.ts`; `tests/shopfloorWoState.test.ts`.
**Behavior:** `transitionWoStatus(current, action, ctx)` returns a discriminated result:
- Actions: `START_JOB | HOLD | RESUME | COMPLETE` (v1 parity; COMPLETE_JOB → COMPLETE).
- `START_JOB`: allowed only from `PLANNED` (and `ON_HOLD`? no — resume first; v1 restart semantics: START_JOB only from PLANNED). Gates from ctx: `ready: boolean` (C2-3), `fixtureOk: boolean`; block codes `NOT_READY`, `FIXTURE_BLOCKED`.
- `HOLD` (reason required): `IN_PROGRESS` → `ON_HOLD`. `RESUME`: `ON_HOLD` → `IN_PROGRESS`.
- `COMPLETE`: `IN_PROGRESS` → `COMPLETED` when `goodQuantity >= plannedQuantity`; else allowed with `override: true` (authorized closure, audited later) — block `QTY_SHORT` otherwise.
- All other combinations → `ILLEGAL_TRANSITION` (e.g. COMPLETED→START_JOB, PLANNED→COMPLETE, ON_HOLD→COMPLETE).
**Tests:** happy chain PLANNED→(ready+fixture)→IN_PROGRESS→COMPLETE(qty ok); NOT_READY block; FIXTURE_BLOCKED block; qty-short block without override + pass with; HOLD/RESUME roundtrip; ILLEGAL for COMPLETED→START_JOB, PLANNED→COMPLETE, ON_HOLD→COMPLETE.

### Task C2-2: Production/downtime event ledger (pure, TDD)

**Files:** Create `src/lib/shopfloor/eventLedger.ts`; `tests/shopfloorEventLedger.test.ts`.
**Behavior:** pure reducer `applyEvent(state: RunState, ev: OperatorEvent)` → `{ state, writes }`.
- `RunState`: `{ workOrderId, machineId, openLog: { good, scrap, rework } | null, openDowntime: { reasonCode, startedAt } | null, machineState }`.
- Events: `GOOD qty`, `SCRAP qty defectCode`, `REWORK qty`, `DOWNTIME_START reasonCode`, `DOWNTIME_END`, machine actions `SETUP | RUN | CHANGEOVER` (+ ledger-level `START_JOB`, `COMPLETE_JOB` from C2-1 wiring).
- Rules: counters only mutate when a log is open (START_JOB opened it); DOWNTIME_START while one open → `DOWNTIME_ALREADY_OPEN`; DOWNTIME_END without open → `NO_OPEN_DOWNTIME`; qty must be ≥1 int → `INVALID_QTY`. `writes` is an explicit list of typed row intents (counter deltas / log create / log close with duration) so the later DB adapter is a dumb mapper — engines never touch Prisma (G-7 no-delete is structural: ledger only appends/intents, never deletes).
- Machine state mapping (C2-7 folded here): START_JOB→RUNNING, RUN→RUNNING, SETUP→SETUP, CHANGEOVER→SETUP, COMPLETE_JOB→IDLE.
**Tests:** GOOD/SCRAP/REWORK accumulate into open log only; counter-less events before open log → `NO_OPEN_LOG`; downtime open/close pair yields duration close intent; double downtime start blocked; END without start blocked; machine-state transitions; writes list is append-only and exact.

### Task C2-3: Readiness engine re-spec (pure, TDD)

**Files:** Create `src/lib/shopfloor/readiness.ts`; `tests/shopfloorReadiness.test.ts`.
**Behavior:** `checkReadiness(snapshot: ReadinessSnapshot)` → `{ ready: boolean; gaps: ReadinessGap[] }`. Snapshot is structural (caller assembles from DB): materials (required vs available/short), required certs present?, drawing rev current?, fixture AVAILABLE?, assigned instruments calibrated?, FAI satisfied for part-rev (when faiRequired). Each gap: `{ code: "MATERIAL_SHORT" | "CERT_MISSING" | "DRAWING_REV" | "FIXTURE_UNAVAILABLE" | "CALIBRATION_EXPIRED" | "FAI_PENDING", label }`. Not-ready if any gap. Re-spec note: extends v1 materials-only `readinessEngine.ts`; v1 behavior for the material subset preserved (same statuses per material).
**Tests:** all-clear → ready; each single gap type fires with right code; faiRequired=false never yields FAI_PENDING; multiple gaps reported together.

### Task C2-4: Routing/hold-point advance (pure, TDD)

**Files:** Create `src/lib/shopfloor/routing.ts`; `tests/shopfloorRouting.test.ts`.
**Behavior:** `canAdvanceSeq(currentSeq, steps, signoffs)` → allowed unless the current step `isHoldPoint` and lacks a PASSED/CONCESSION signoff → block `HOLD_POINT_UNSIGNED`. Also `nextSeqAfterComplete` helpers. Tests: normal advance; hold-point without signoff blocked; signoff present passes; seq bounds.

### Task C2-5: Shift-count machine (pure, TDD)

**Files:** Create `src/lib/shopfloor/shiftCount.ts`; `tests/shopfloorShiftCount.test.ts`.
**Behavior:** `evaluateShiftCount(outCount, inCount, tolerancePct)` → `AGREED` when |out−in| ≤ tolerance else `DISPUTED`; `resolveDispute(status, finalCount, authority: boolean)` → RESOLVED only from DISPUTED and with authority (manager seat) else `AUTHORITY_REQUIRED`. Tests: within/over tolerance; dispute→resolve; resolve without authority blocked; resolve from PENDING illegal.

### Task C2-6: Typed adapter + v2 routes (typecheck gate)

**Files:** `src/lib/shopfloor/applyJobAction.ts` (DB adapter: load WO+machine+open log in tx → run engine → write intents → audit via C1 `recordAudit`; idempotency via C1 `runIdempotent(prisma, clientId, scope, fn)`); routes `src/app/api/v2/shopfloor/action/route.ts` (POST, zod `parseOr400`, actions from C2-1/2, state-conflict 412 parity), `src/app/api/v2/shopfloor/readiness/route.ts` (GET?workOrderId=…). **Verify:** `tsc --noEmit` exit 0; `as any` grep none; RED/GREEN unit tests where adapter logic is extracted pure. DB smoke deferred (no Postgres here) — mark boundary in route comments.

### Task C2-7: Cycle 2 verification gate

1. All new suites green (record counts) from `.env`-free cwd.
2. `tsc --noEmit` exit 0 whole repo.
3. `as any` scan of `src/lib/shopfloor` + `src/app/api/v2/shopfloor` → none.
4. Parity checklist vs v1 route named in plan (each action mapped; re-spec deltas recorded).
5. Update DEPTH_03 F2 / DEPTH_04 W2 cross-ref notes (state core implemented; terminal/UI + andon/IoT remain v1 surfaces); mark this plan COMPLETE with evidence + boundaries.

---

## C2 out of scope (later cycles)
Serial-unit allocation & genealogy, tool-life decrementing, SPC/capability, capacity/S&OP, andon/IoT/MQTT persistence, operator terminal UI rebuild, offlineSync v2, scrap MRB auto-quarantine wiring (C3 owns NCR/MRB), job-cost finalization (C6).
