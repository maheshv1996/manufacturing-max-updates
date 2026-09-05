# Cycle 4 — Engineering & Change Control Core Implementation Plan

> **STATUS: CYCLE COMPLETE — 2026-09-05.** Engines (`eco`, `revision`, `documentRev`) + typed adapter (`changeTx.ts`: createEco, transitionEcoTx, issueDocumentRevTx — in-tx, idempotent, audited; superseded doc rows ARCHIVED, never deleted) + 3 routes under `/api/v2/change/*` all landed on `v2` (uncommitted). Full gate: **21 tests across 3 suites, 0 fail**; `tsc --noEmit` exit 0; `as any` scan clean. **Real-DB smoke (scratch `mfgmax_v2_test`):** ECO with 2 items → APPROVE blocked (empty + malformed date effectivity) → APPROVED with effectivity → IMPLEMENTED (approvedAt/implementedAt set); REJECT path + G-5 IMPLEMENT blocked from DRAFT and REJECTED; document v1→v2 issue (v1 ARCHIVED, v2 CURRENT), downgrade blocked; 6 change audits. Total v2 test inventory now **134 across 22 suites** (C1 40 + C2 40 + C3 33 + C4 21). Remaining boundaries: SERIAL effectivity per-unit enforcement lands with genealogy (C3 note); ECO approval-chain seat wiring via org resolver (C12); file storage/streaming stays v1.

**Goal (master plan C4):** Rebuild the engineering/change-control **state core** from DEPTH_03 F4 / DEPTH_04 W7 — retiring the primary risk: **revision-as-law** (G-5: an ECO cannot reach IMPLEMENTED without APPROVED state + defined effectivity; obsolete revisions never reach the floor). Pure engines first, then typed adapter + `/api/v2/change/*` routes with a real-DB smoke.

**Grounded findings (2026-09-05, read from repo):**
- Real enums: `EcoStatus DRAFT|APPROVED|IMPLEMENTED|REJECTED`; `EcoEffectivityType DATE|SERIAL`; `EcoAction REPLACE|ADD|REMOVE`; `EcoEntityType BOM|DRAWING|ROUTING`. Model `Eco` (ecoNumber unique, title, description, status, effectivityType @default DATE, `effectivityValue String` (required — but empty string until set), raisedBy, approvedBy/At, implementedAt) + `EcoItem` (entityType, productId, action, oldData/newData Json, notes).
- Guardrail **G-5** (DEPTH_01 §6): "An ECO cannot be IMPLEMENTED without APPROVED state and effectivity defined (date/serial/BOM rev)." W7 step: approval chain → APPROVED with effectivity recorded → IMPLEMENTED updates live BOM/routing/doc rev with audit + archived superseded revision → floor consequence via readiness engine (current revision only; obsolete rev flagged — C2-3 already types `DRAWING_REV`).
- v1 `Document` model exists (revision-controlled); `DrawingTransmittal` separate. C2-3 readiness has the `DRAWING_REV` gap; C4 wires the rev comparison.

**Scope (pure engines first):**
- C4-1 ECO state machine + G-5 — DRAFT→APPROVED|REJECTED→IMPLEMENTED; APPROVE requires ≥1 item **and** a syntactically valid effectivity for its type (DATE = parseable ISO date; SERIAL = `N` | `N+` | `A..B`); REJECT from DRAFT only; IMPLEMENTED only from APPROVED (G-5 is structural: only an APPROVED ECO with recorded effectivity can implement).
- C4-2 Revision law — `isObsoleteRev(currentRev, usedRev)`; WO legality vs ECO effectivity (`woAllowedRev`: a WO starting before a DATE effectivity may use the old rev; from the effectivity date the new rev is law); floor consequence feeds C2-3's `DRAWING_REV` gap.
- C4-3 Document revision issuing — `issueRevision(currentRev, newRev)` (new must be > current, no silent overwrite; superseded revs archived not deleted — no-delete); `canUseRev` for floor references.
- C4-4 Adapter + routes — `changeTx.ts` + `/api/v2/change/eco/*` (create, action), `/api/v2/change/documents/*` (issue rev); engineering.edit / engineering.approve gating; in-tx + idempotent + audited; scratch-DB smoke (Eco with items → APPROVE blocked w/o effectivity → APPROVED → IMPLEMENTED; obsolete-rev check against a Document).
- C4-5 Cycle gate + DEPTH cross-refs (F4, W7, G-5 note).

**Out of scope (later cycles / existing v1 surfaces):** document file storage/streaming, DrawingTransmittal, fixture register UI, CNC program/tool-offset registry, BOM cost explosion engine, floor UI for rev badges.

**Verify commands (whole cycle):** `tsc --noEmit` whole repo; `npm test` (or bun from `.env`-free cwd); `grep -rn "as any" src/lib/change src/app/api/v2/change` → none.

---

### Task C4-1: ECO state machine + G-5 effectivity gate (pure, TDD)
**Files:** `src/lib/change/eco.ts`; `tests/changeEco.test.ts`.
**Behavior:** `transitionEco(current, action, ctx)` — actions `APPROVE { itemCount, effectivityType, effectivityValue } | REJECT { note } | IMPLEMENT { note? }`; APPROVE from DRAFT: itemCount ≥1 (else `NO_ITEMS`), effectivity valid for type (else `EFFECTIVITY_INVALID`, naming why); REJECT from DRAFT (note required — `NOTE_REQUIRED`); IMPLEMENT from APPROVED only (from DRAFT/REJECTED → `ILLEGAL_TRANSITION`; this IS G-5: no path to IMPLEMENTED without APPROVED + effectivity); REJECTED terminal; IMPLEMENTED terminal.
**Tests (~10):** happy path DRAFT→APPROVED(DATE)→IMPLEMENTED; approve with 0 items blocked; DATE effectivity bad string blocked, good ISO passes; SERIAL `N`, `N+`, `A..B` pass; SERIAL junk blocked; REJECT without note blocked; REJECT from APPROVED illegal; IMPLEMENT from DRAFT and from REJECTED illegal; REJECTED/IMPLEMENTED terminal (further actions illegal).

### Task C4-2: Revision law (pure, TDD)
**Files:** `src/lib/change/revision.ts`; `tests/changeRevision.test.ts`.
**Behavior:** `isObsoleteRev(currentRev, usedRev)` — obsolete when `usedRev !== currentRev` (string compare on the current value; higher rev wins when numeric-suffix convention — compare as strings for rev codes, numeric when both numeric). `woAllowedRev({ woStart, effectivityDate, effectivityType, currentRev })` → `{ allowed: boolean; requiredRev }`: for DATE effectivity, WO starting **before** the date may use the old rev (not obsolete); at/after → new rev required (obsolete). For SERIAL effectivity → serial-unit rules land with genealogy (C3 note): default new-rev-required. Floor gap wiring: `revisionGap(wo)` returns `DRAWING_REV`-shaped result consumed by C2-3.
**Tests (~8):** equal revs not obsolete; mismatch obsolete; numeric rev compare (rev 2 > rev 1); WO before DATE effectivity allowed with old rev; WO at/after DATE effectivity → obsolete/new required; SERIAL default → new required; `revisionGap` shapes.

### Task C4-3: Document revision issuing (pure, TDD)
**Files:** `src/lib/change/documentRev.ts`; `tests/changeDocumentRev.test.ts`.
**Behavior:** `issueRevision(currentRev, newRev)` → ok when `newRev > currentRev` (numeric-aware compare) else `REV_NOT_FORWARD` (no silent overwrite / no downgrade); `canUseRev(currentRev, usedRev)` → ok only when equal (obsolete otherwise — floor can only use the current rev); revision identifiers validated (non-empty, no whitespace).
**Tests (~7).**

### Task C4-4: Adapter + `/api/v2/change/*` routes (typecheck + DB smoke)
**Files:** `src/lib/change/changeTx.ts` + routes `src/app/api/v2/change/eco/route.ts` (create), `.../eco/action/route.ts` (APPROVE/REJECT/IMPLEMENT), `.../documents/route.ts` (issue revision). Gating: `engineering.edit` for create/issue; `engineering.approve` for APPROVE/IMPLEMENT. DB smoke on scratch DB: create Eco with 1 item → APPROVE without effectivity → blocked; APPROVE with DATE effectivity → APPROVED; IMPLEMENT → IMPLEMENTED(implementedAt); REJECT path on a second Eco; document rev issue + obsolete check.

### Task C4-5: Cycle 4 verification gate
1. All new suites green; whole repo `tsc --noEmit` exit 0; `as any` scan clean.
2. Parity checklist vs W7 state machine + G-5; DEPTH_03 F4 + DEPTH_04 W7 cross-ref notes; mark this plan COMPLETE with evidence + boundaries.

---

## C4 out of scope (later cycles)
Document storage/streaming, transmittal/ack, fixture register, CNC tool-offset registry, BOM cost explosion, genealogy-serial effectivity enforcement (C3/next), approval-chain wiring of ECO approval seats (uses org approval resolver — C12 UI; engine accepts authority flags).