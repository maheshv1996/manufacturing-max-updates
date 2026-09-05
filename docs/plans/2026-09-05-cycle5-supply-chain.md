# Cycle 5 — Supply Chain & Purchasing Core Implementation Plan

> **For the executing agent:** Work on branch `v2`. TDD every task: failing test first (RED evidence) → minimal implementation (GREEN) → refactor. verification-before-completion: run the command, read the output, then claim.

**Goal (master plan C5):** Rebuild the supply-chain **state core** from DEPTH_03 F5 / DEPTH_04 W3/W4/W12 — retiring the primary risk: **atomic stock + cert gating** (no double receipts, no negative stock races, no uncerted material entering usable stock when `requireMillCerts` is on). Pure engines first, then typed adapter + `/api/v2/supply/*` routes with a real-DB smoke.

**Status (2026-09-05): COMPLETE.** All tasks done. Notable call: `stockAfterTx`/`applyMovement` allow negative qty on ADJUST (count-down corrections are legal) but block any resulting negative balance — no silent negatives. Final gate: `tsc --noEmit` exit 0; `as any` scan clean (only doc-comment mentions); **333 pass / 0 fail across 23 suites** (C5 adds 45: 12+13+11+9).

**Evidence (scratch DB `mfgmax_v2_test`, real Postgres):** approval ladder with manager/owner escalation and tier rejection; REJECT terminal; receipt without a linked cert **blocked** (`CERT_REQUIRED`, W3); receipt with certs posts stock IN atomically, PO ORDERED→PARTIAL→RECEIVED; over-delivery beyond tolerance **blocked**; double-receipt **rejected**; cycle-count variance → authorized ADJUST posts to the ledger; W4 dispatch gated on accredited scope, receive-back gated on special-process certs, FAIL signoff routes an NCR; duplicate GRN (same clientId) skipped idempotently; `QC_FAILED` added to `SubcontractStatus`. W3/W4/W12 parity checklist: no-delete receipts ✓ (no delete path exists), atomic stock ✓ (one `$transaction` per receipt/adjust), idempotent GRN ✓ (C1 `runIdempotent`), cert-before-use ✓ (`CERT_REQUIRED` gate), accredited-scope ✓.

**Boundaries (later cycles):** three-way match with invoices/payments (C6), MRP/BOM explosion, rate contracts + comparative statements, supplier scorecard engine, write-off GL posting, freight/telematics, supplier portal/ASN/EDI, serial-genealogy cert links (C3), cycle-count UI. DEPTH_03 F5 + DEPTH_04 W3/W4/W12 carry cross-ref notes.

**Grounded findings (2026-09-05, read from repo):**
- Real enums: `POStatus ORDERED|PARTIAL|RECEIVED|CANCELLED`; `GrnInspectionStatus PENDING|PASSED|REJECTED|HELD`; `ThreeWayMatchStatus UNMATCHED|PARTIAL|MATCHED|MISMATCHED`. Models: `PurchaseOrder` (single-line: rawMaterialId, qty, unitCost, status, receivedQty, approvalStatus String APPROVED|PENDING_MANAGER|PENDING_OWNER|REJECTED, approvalLevel MANAGER|OWNER, manager/owner approved fields), `PurchaseOrderLine` (poLineId on GRN), `GoodsReceiptNote` (poId, supplierId, rawMaterialId, receivedQty, batchNo, inspectionStatus, matchStatus, lotHeld), `InventoryTransaction` (type IN|OUT|ADJUST, qty, unitCost, reference, batchNo, materialCert? relation), `MaterialCert`, `RawMaterial` (materialCerts relation; no per-material flag — cert requirement is the global `requireMillCerts` setting per W3), `SubcontractChallan`, `CycleCountSession/Line` (W12).
- W3 guardrails: no-delete receipts, atomic stock updates, idempotent GRN, cert-before-use for tracked material. W12: variance vs tolerance → approved ADJUST with reason. W4: accredited-scope gating for special processes.

**Scope (pure engines first):**
- C5-1 PO state machine — two concerns: (a) **approval ladder** (approvalStatus APPROVED initial; over manager threshold → PENDING_MANAGER → manager ok → over owner threshold ? PENDING_OWNER : APPROVED; owner ok → APPROVED; REJECTED with reason terminal); (b) **receipt status** ORDERED → PARTIAL → RECEIVED; CANCELLED only when nothing received; over-delivery blocked beyond org tolerance.
- C5-2 Receipt + cert + stock gate — `applyReceipt` (status + receivedQty + poQty + tolerancePct + certsRequired + certsLinked) → next PO status + new received; block codes `OVER_DELIVERY`, `CERT_REQUIRED` (no cert for tracked material), `ALREADY_RECEIVED` (received ≥ qty — the double-receipt guard; idempotency layer catches replays, this catches genuine second shipments). `stockAfterTx(balance, type, qty)` pure — OUT beyond balance → `NEGATIVE_STOCK` (no silent negatives); IN/ADJUST allowed with ADJUST reason.
- C5-3 Inventory movement + cycle-count core — `applyMovement` reducer (IN/OUT/ADJUST each typed with reason/actor), `varianceCheck(bookQty, countedQty, tolerancePct)` → WITHIN | OUT_OF_TOLERANCE, `approveAdjustment` (variance out-of-tolerance needs authority + reason).
- C5-4 Subcontract challan machine (W4) — OUT → (INWARD) → QC signoff: accredited scope check (vendor accredited for the process when contract requires) → PASS returns to stock / FAIL → NCR. Block `VENDOR_NOT_ACCREDITED`, `CERT_MISSING`.
- C5-5 Adapter + routes — `supplyTx.ts` + `/api/v2/supply/{po,receipt,cycle-count,subcontract}/*`; supply.edit / supply.approve gating; in-tx + idempotent + audited; scratch-DB smoke: PO approval ladder, receipt without cert blocked, receipt posts stock IN atomically + PO PARTIAL→RECEIVED, over-delivery blocked, cycle-count variance → approved adjust, double receipt rejected.
- C5-6 Cycle gate + DEPTH cross-refs (F5, W3/W4/W12).

**Out of scope (later cycles / existing v1 surfaces):** MRP explosion, supplier scorecards/rate contracts, write-off GL, freight/telematics, supplier portal/ASN, three-way match full engine (invoice/payment belongs to C6), serial/lot genealogy link (C3).

**Verify commands (whole cycle):** `tsc --noEmit` whole repo; `npm test` (or bun from `.env`-free cwd); `grep -rn "as any" src/lib/supply src/app/api/v2/supply` → none.

---

### Task C5-1: PO state machine — approval ladder + receipt status (pure, TDD)
**Files:** `src/lib/supply/po.ts`; `tests/supplyPo.test.ts`.
**Behavior:** `advancePoApproval(current, { tier: "MANAGER"|"OWNER", reason? })` → APPROVED/PENDING_MANAGER/PENDING_OWNER/REJECTED; REJECTED terminal (reason required). `receiptStatus(current, { receivedQty, poQty, tolerancePct })` → next POStatus; `applyReceipt`-adjacent guard: over-delivery beyond tolerance → `OVER_DELIVERY`; CANCELLED only from received 0.
**Tests (~10):** tier ladder (below/above manager → above owner); manager → owner → APPROVED; reject + reason; reject terminal; receipt ORDERED→PARTIAL→RECEIVED; over-delivery within tolerance ok; beyond tolerance blocked; CANCELLED with received>0 illegal; CANCELLED from RECEIVED illegal.

### Task C5-2: Receipt + cert + stock gate (pure, TDD)
**Files:** `src/lib/supply/receipt.ts`; `tests/supplyReceipt.test.ts`.
**Behavior:** `applyReceipt({ poStatus, receivedQty, poQty, tolerancePct, certsRequired, certsLinked })` → `{ ok, nextStatus, newReceived }` or block `OVER_DELIVERY | CERT_REQUIRED | ALREADY_RECEIVED`. `stockAfterTx(balance, { type, qty })` → OUT beyond balance → `NEGATIVE_STOCK`; ADJUST without reason → `ADJUST_REASON_REQUIRED`.
**Tests (~10):** full receipt flow; cert missing blocks IN for tracked material; cert present passes; over-delivery tolerance; already-received guard; negative stock blocked; adjust requires reason.

### Task C5-3: Inventory movement + cycle-count core (pure, TDD)
**Files:** `src/lib/supply/inventory.ts`; `tests/supplyInventory.test.ts`.
**Behavior:** `applyMovement(state, tx)` → `{ state, write }` (IN/OUT/ADJUST; OUT guarded by balance); `varianceCheck(bookQty, countedQty, tolerancePct)` → `{ within: boolean, variance }`; `approveAdjustment(variance, { authority, reason })` → OUT_OF_TOLERANCE variance requires both → `AUTHORITY_REQUIRED`/`REASON_REQUIRED`.
**Tests (~8).**

### Task C5-4: Subcontract challan machine (pure, TDD)
**Files:** `src/lib/supply/subcontract.ts`; `tests/supplySubcontract.test.ts`.
**Behavior:** `dispatchChallan({ accredited, contractRequiresAccreditation })` → `VENDOR_NOT_ACCREDITED` when contract requires + not accredited; `receiveBack({ certsPresent, specialProcessCertsRequired })` → `CERT_MISSING`; `signOff(result: "PASS"|"FAIL")` → PASS returns; FAIL routes NCR (flag).
**Tests (~7).**

### Task C5-5: Adapter + `/api/v2/supply/*` routes (typecheck + DB smoke)
**Files:** `src/lib/supply/supplyTx.ts` + routes; gating `supply.edit` (create/receive) / `supply.approve` (PO approval, cycle-count adjust). DB smoke on scratch DB: RawMaterial + Supplier + PO → approval ladder → receipt without cert blocked → receipt with cert posts IN + PARTIAL → second receipt → RECEIVED; over-delivery blocked; cycle-count variance → approved adjust; duplicate GRN (same key) skipped.

### Task C5-6: Cycle 5 verification gate
1. All new suites green; whole repo `tsc --noEmit` exit 0; `as any` scan clean.
2. Parity checklist vs W3/W4/W12 state machines + guardrails (no-delete receipts, atomic stock, idempotent GRN, cert-before-use, accredited-scope).
3. DEPTH_03 F5 + DEPTH_04 W3/W4/W12 cross-ref notes; mark this plan COMPLETE with evidence + boundaries.

---

## C5 out of scope (later cycles)
MRP/BOM explosion, rate contracts + comparative statements, supplier scorecard engine, write-off GL posting, freight/telematics, supplier portal/ASN/EDI (Tier-1 connect), three-way match with invoices (C6), serial-genealogy cert links (C3), cycle-count UI.