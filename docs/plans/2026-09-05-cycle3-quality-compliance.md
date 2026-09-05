# Cycle 3 — Quality & Aero Compliance Core Implementation Plan

> **STATUS: CYCLE COMPLETE — 2026-09-05.** Engines (`ncrState`, `eightD`, `fai`, `dataPackage`, `complaintSla`) + typed adapter (`qualityTx.ts`: NCR/8D/FAI/data-package create+transition/release/mutate, in-tx + idempotent + audited) + 8 routes under `/api/v2/quality/*` all landed on `v2` (uncommitted). Full gate: **113 tests across 19 suites, 0 fail** (C1 40 + C2 40 + C3 33); `tsc --noEmit` exit 0; `as any` scan clean. **Real-DB smoke (scratch `mfgmax_v2_test`):** NCR from scrap quarantine → review → dispose(REWORK/QUALITY) → CLOSE-with-note enforced → CLOSED(closedAt); USE_AS_IS concession: QUALITY blocked / CUSTOMER passed; FAI: unjustified deviation submit blocked → justified submit → APPROVED(approvedAt); data package: release blocked w/o FAI → RELEASED → mutate FROZEN → newRevision ok; 9 quality audits. Remaining boundaries: gates (`certsPresent`/`itemCount`) are caller-assembled until the contents builder lands; org-config concession flag defaulted false until C12 wiring; complaint/8D SLA routes join C3-5 with the next slice.

**Goal (master plan C3):** Rebuild the quality/compliance **state core** from DEPTH_03 F3 / DEPTH_04 W5–W6 — retiring the primary risk: **guardrail enforcement depth (G-1…G-6)**. Typed, DB-free, TDD-proven engines first; DB adapter + `/api/v2/quality/*` routes follow in-cycle (typecheck gate + real-DB smoke like C2).

**Grounded findings (2026-09-05, read from repo):**
- Real enums: `FaiReportStatus IN_PROGRESS|SUBMITTED|APPROVED|REJECTED`; `NcrStatus OPEN|UNDER_REVIEW|DISPOSITIONED|CLOSED`; `NcrDisposition USE_AS_IS|REWORK|SCRAP|RETURN_TO_SUPPLIER`; `NcrDispositionAuthority QUALITY|ENGINEERING|CUSTOMER`; `EightDStatus D1_TEAM…D8_CLOSURE|CLOSED`; `DataPackageStatus DRAFT|RELEASED`. Models `FaiReport/FaiCharacteristic`, `NcrReport` (+`quarantineId`, `ScrapQuarantine` link), `EightDReport` (evidence fields: `containmentAction`, `rootCauseSummary`, `correctiveAction`, `preventiveAction`, `verificationMethod`), `DataPackage`, `MaterialCert`, `HoldPointSignoff`, `CustomerComplaint`.
- Guardrail charter (DEPTH_01 §6): **G-1** FAI before full production; **G-2** hold-point signoff before advance; **G-3** 8D cannot CLOSE without D4–D7 evidence; **G-4** calibration-expired instruments cannot record inspection results; **G-5** ECO IMPLEMENTED requires APPROVED + effectivity; **G-6** released data package frozen (changes = new revision + audit).
- v1 libs that exist (parity references): `mrbPolicy.ts`, `complaintSla.ts`, `calibration.ts`, `dataPackageLiveFetch.ts`; C2 already landed the hold-point advance rule (`routing.ts`, G-2) and the FAI production gate in the shopfloor adapter (G-1, `assertFaiGate`).
- C2's `ScrapQuarantine` creation on LOG_SCRAP is in; the NCR auto-open link is C3 work (W5 step 1).

**Scope (pure engines first):**
- C3-1 NCR state machine — OPEN→UNDER_REVIEW→DISPOSITIONED→CLOSED; disposition requires authority + written justification; USE_AS_IS may require CUSTOMER authority when contract requires (config flag); CLOSED requires written note.
- C3-2 8D state machine + G-3 — single-step forward-only advance; leaving an evidence stage requires that stage's evidence (containment/root cause/corrective/preventive/verification); entering D8_CLOSURE requires all four (G-3); CLOSED requires quality-manager review flag.
- C3-3 FAI state machine — IN_PROGRESS→SUBMITTED (every FAIL characteristic must carry a deviation justification — else UNJUSTIFIED_DEVIATION); SUBMITTED→APPROVED|REJECTED.
- C3-4 Data-package release gate (G-6) — DRAFT→RELEASED requires completeness (FAI approved when required, certs present, contents non-empty); post-RELEASE mutation attempts blocked unless `newRevision` (frozen semantics).
- C3-5 Complaint SLA core — ack deadline 24h / 8D deadline 10d from receipt; overdue flags computed from timestamps (parity with `complaintSla.ts`).
- C3-6 Adapter + routes — `/api/v2/quality/{ncr,eight-d,fai,data-package}/*` typed, zod edges, audits; typecheck gate + DB smoke on scratch Postgres (create NCR from scrap quarantine, drive to CLOSED with evidence; FAI APPROVED unblocks G-1 in the shopfloor path).
- C3-7 Cycle gate + DEPTH cross-refs (F3, W5/W6, G-1…G-6 status notes).

**Out of scope (later cycles / existing v1 surfaces):** serial genealogy UI, calibration lab full lifecycle (G-4 instrument gate wiring lands with inspection routes), PPAP/control plans, MRM agenda, customer scorecards, NCR→8D→SCAR supplier loop UI.

**Verify commands (whole cycle):** `tsc --noEmit` (whole repo); `npm test` for the sanctioned runner (or bun from `.env`-free cwd); `grep -rn "as any" src/lib/quality src/app/api/v2/quality` → none.

---

### Task C3-1: NCR state machine (pure, TDD)
**Files:** `src/lib/quality/ncrState.ts`; `tests/qualityNcrState.test.ts`.
**Behavior:** `transitionNcr(current, action, ctx)` — actions `START_REVIEW | DISPOSE | CLOSE`; DISPOSE requires `disposition`, `authority`, `justification` (non-empty); USE_AS_IS + `contractRequiresCustomerConcession` + authority≠CUSTOMER → `AUTHORITY_REQUIRED`; CLOSE requires non-empty `closeNote`; all other combos → `ILLEGAL_TRANSITION` (incl. CLOSE from OPEN, DISPOSE twice).
**Tests (~8):** happy path OPEN→REVIEW→DISPOSITIONED(REWORK/QUALITY)→CLOSED; DISPOSE missing justification → `JUSTIFICATION_REQUIRED`; USE_AS_IS without concession flag passes with QUALITY; with concession flag QUALITY → `AUTHORITY_REQUIRED`, CUSTOMER passes; CLOSE without note → `NOTE_REQUIRED`; CLOSE from OPEN → ILLEGAL.

### Task C3-2: 8D state machine + G-3 evidence gate (pure, TDD)
**Files:** `src/lib/quality/eightD.ts`; `tests/qualityEightD.test.ts`.
**Behavior:** `advanceEightD(current, evidence, opts)` — forward-only single stage; leaving an evidence-bearing stage requires its evidence (containment for D3, root cause for D4, corrective D5, preventive D6, verification D7); entering `D8_CLOSURE` additionally requires ALL of D4–D7 (G-3); `CLOSED` only from `D8_CLOSURE` with `reviewed: true` (quality manager) else `REVIEW_REQUIRED`; CLOSED terminal.
**Tests (~9):** full walk D1→CLOSED with evidence; missing root cause blocks leaving D4 → `EVIDENCE_MISSING` (message lists missing stage); missing verification blocks D7→D8; G-3: enter D8_CLOSURE missing any of D4–D7 → `EVIDENCE_MISSING`; D8_CLOSURE→CLOSED without review → `REVIEW_REQUIRED`, with review passes; skip (D2→D4) → `ILLEGAL_TRANSITION`; advance from CLOSED → ILLEGAL.

### Task C3-3: FAI state machine + deviation rule (pure, TDD)
**Files:** `src/lib/quality/fai.ts`; `tests/qualityFai.test.ts`.
**Behavior:** `transitionFai(current, action, ctx)` — `SUBMIT` from IN_PROGRESS requires ≥1 characteristic and every FAIL characteristic `deviationJustified` (else `UNJUSTIFIED_DEVIATION` with list); `DECIDE approve:boolean` only from SUBMITTED → APPROVED|REJECTED; anything else → `ILLEGAL_TRANSITION` (REJECTED→APPROVED, IN_PROGRESS→DECIDE, APPROVED→SUBMIT).
**Tests (~8):** submit with all pass; submit with justified deviation; submit with unjustified FAIL → blocked + names the characteristic; submit with zero characteristics → `NO_CHARACTERISTICS`; decide approve → APPROVED; decide reject → REJECTED; ILLEGAL cases.

### Task C3-4: Data-package release gate (G-6, pure, TDD)
**Files:** `src/lib/quality/dataPackage.ts`; `tests/qualityDataPackage.test.ts`.
**Behavior:** `releasePackage(contents)` → ok when `faiRequired`→faiApproved, `certsPresent`, `items ≥ 1` (block codes `FAI_MISSING | CERT_MISSING | EMPTY_PACKAGE`); `mutatePackage(status)` → allowed only in DRAFT; RELEASED without `newRevision: true` → `FROZEN` (G-6); with newRevision → allowed (new revision semantics).
**Tests (~7).**

### Task C3-5: Complaint SLA core (pure, TDD)
**Files:** `src/lib/quality/complaintSla.ts`; `tests/qualityComplaintSla.test.ts` (new module; v1 `complaintSla.ts` stays untouched as parity ref).
**Behavior:** `slaStatus(createdAt, ackAt, now)` → `{ ack: "OK"|"OVERDUE"|"PENDING", eightD: "OK"|"OVERDUE"|"PENDING", ackDeadline, eightDDeadline }`; ack window 24h, 8D window 10d from `createdAt` (ackAt only stamps ack — v1 semantics).
**Tests (~5):** fresh → PENDING/PENDING; ack within 24h → OK; ack after 24h → OVERDUE; no ack past 24h → OVERDUE; 8D overdue past 10d.

### Task C3-6: Adapter + `/api/v2/quality/*` routes (typecheck + DB smoke)
**Files:** `src/lib/quality/qualityTx.ts` (or per-domain adapters) + routes `src/app/api/v2/quality/{ncr,eight-d,fai,data-package}/route.ts`. Pattern per C2: `runIdempotent` + `$transaction` + in-tx `recordAudit`-equivalent; zod `parseOr400`; seat/permission gating (`quality.edit`/`quality.approve`; USE_AS_IS concession authority = `quality.approve` + customer flag per org config). DB smoke on scratch DB: scrap quarantine → NCR OPEN → DISPOSITIONED(REWORK) → CLOSED; FAI APPROVED → shopfloor LOG_GOOD unblocks (reuse C2 smoke fixture); RELEASED package rejects mutation, newRevision accepts.

### Task C3-7: Cycle 3 verification gate
1. All new suites green (record counts); whole repo `tsc --noEmit` exit 0; `as any` scan clean.
2. Parity checklist vs W5/W6 state machines + guardrail charter G-1…G-6 (each guardrail named with its enforcing engine/route).
3. DEPTH_03 F3 + DEPTH_04 W5/W6 cross-ref notes; mark this plan COMPLETE with evidence + boundaries.

---

## C3 out of scope (later cycles)
Serial/genealogy engine + UI, calibration lifecycle engine + G-4 inspection-route wiring, PPAP/control plans, customer scorecards, MRM, SCAR supplier loop UI, data-package assembly from live docs (contents builder uses C3-4 gate + C2/C5 loads).