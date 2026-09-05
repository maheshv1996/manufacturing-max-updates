# Cycle 6 — Commercial & Finance Core Implementation Plan

> **For the executing agent:** Work on branch `v2`. TDD every task: failing test first (RED evidence) → minimal implementation (GREEN) → refactor. verification-before-completion: run the command, read the output, then claim.

**Goal (master plan C6):** Rebuild the commercial & finance **state core** from DEPTH_03 F6/F7, DEPTH_04 W1/W8/W9 — retiring the primary risk: **paise money end-to-end, balanced GL, quote→SO→dispatch→invoice integrity**. Pure engines first, then typed adapter + `/api/v2/commercial/*` + `/api/v2/finance/*` routes with a real-DB smoke.

**Status (2026-09-05): PLANNED — implementation starts now.**

---

## 1. Existing assets to reuse/retire

| Asset | Status | Action |
|---|---|---|
| `src/lib/money.ts` | ✅ v1, paise helpers + `MONEY_KEYS` | Reuse as-is; extend `MONEY_KEYS` for new models |
| `src/lib/quotations.ts` | ⚠️ v1, prisma-coupled | Retire; replace with `src/lib/commercial/quotations.ts` pure engine |
| `src/lib/salesOrders.ts` | ⚠️ v1, prisma-coupled | Retire; replace with `src/lib/commercial/salesOrders.ts` pure engine |
| `src/lib/glCore.ts` | ⚠️ v1, mixed pure/impure | Retire; replace with `src/lib/finance/glCore.ts` pure engine |
| `src/lib/glEngine.ts` | ⚠️ v1, prisma-coupled | Retire; replace with `src/lib/finance/glPosting.ts` pure + adapter |
| `src/lib/glPosting.ts` | ⚠️ v1, prisma-coupled | Retire; replace with v2 adapter |
| `src/lib/fixedAssets.ts` | ✅ v1 pure engine | Reuse as-is; wrap in v2 adapter |
| `src/lib/invoicingEngine.ts` | ⚠️ v1, prisma-coupled | Retire; replace with `src/lib/commercial/invoices.ts` pure engine |

**Rule:** v1 files are NOT deleted until C6 passes its verification gate and parity review.

---

## 2. Scope

### In scope
- **Quotation state machine:** DRAFT → SENT → WON | LOST | CONVERTED; line costing; margin check
- **SalesOrder state machine:** DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED | CANCELLED; line-wise dispatch/invoice gating
- **DispatchRecord state machine:** PLANNED → DISPATCHED; E-way bill / vehicle / driver
- **Invoice state machine:** DRAFT → SENT → PAID | PARTIAL | OVERDUE; line-wise paise totals; GST split
- **Payment state machine:** PENDING → CLEARED | BOUNCED; payment-record linkage
- **GL posting engine:** double-entry journal lines, balanced trial, reversals, maker-checker
- **Treasury engine:** bank reconciliation, statement matching, payment sequencing
- **Fixed-asset engine:** depreciation schedules (SL/WDV), book-value tracking

### Out of scope (later cycles / tier-3)
- Credit/debit notes + sales & purchase returns
- Petty cash register
- Sales quota & commission
- IRN + GSTR-1/3B exports
- TDS compliance tracker
- Contract expiry + milestone alerts

---

## 3. Tasks

### Task C6-1: Commercial state machines — quotations + sales orders (pure, TDD)
**Files:** `src/lib/commercial/quotations.ts`, `src/lib/commercial/salesOrders.ts`, `tests/commercialQuotations.test.ts`, `tests/commercialSalesOrders.test.ts`.

**Behavior:**
- `transitionQuotation(current, action)` → DRAFT→SENT→WON|LOST|CONVERTED; CONVERTED terminal; SENT→WON allowed; WON→CONVERTED allowed; illegal transitions blocked.
- `computeQuoteMargin(lines)` → totalAmount, costAmount, margin, marginPct.
- `nextQuotationNumber(date)` → `QT-YYYY-NNN` format.
- `transitionSalesOrder(current, action)` → DRAFT→CONFIRMED→IN_PROGRESS→COMPLETED|CANCELLED; COMPLETED terminal; CANCELLED only from DRAFT/CONFIRMED.
- `salesOrderFulfillmentStatus(soLines)` → aggregate delivered vs ordered qty.
- `nextSalesOrderNumber(tx, date)` → `SO-YYYY-NNNN` via `nextSequenceTx`.

**Tests (~20):** quotation transitions + margin; SO transitions + fulfillment; numbering.

---

### Task C6-2: Commercial state machines — dispatch + invoice + payment (pure, TDD)
**Files:** `src/lib/commercial/dispatch.ts`, `src/lib/commercial/invoices.ts`, `src/lib/commercial/payments.ts`, `tests/commercialDispatch.test.ts`, `tests/commercialInvoices.test.ts`, `tests/commercialPayments.test.ts`.

**Behavior:**
- `transitionDispatch(current, action)` → PLANNED→DISPATCHED; DISPATCHED terminal; cancel only from PLANNED.
- `transitionInvoice(current, action)` → DRAFT→SENT→PAID|PARTIAL|OVERDUE; OVERDUE when past dueDate and unpaid.
- `applyPayment(invoice, amount)` → PARTIAL/PAID transitions; remaining balance.
- `computeInvoiceTotals(lines)` → taxableValue, cgstAmt, sgstAmt, igstAmt, totalValue (paise).
- `nextInvoiceNumber(date)` → `INV-YYYY-NNN` format.

**Tests (~25):** dispatch transitions; invoice transitions + overdue; payment application + balance; invoice totals paise arithmetic.

---

### Task C6-3: Finance engines — GL core + posting + trial balance (pure, TDD)
**Files:** `src/lib/finance/glCore.ts`, `src/lib/finance/glPosting.ts`, `src/lib/finance/trialBalance.ts`, `tests/financeGlCore.test.ts`, `tests/financeGlPosting.test.ts`, `tests/financeTrialBalance.test.ts`.

**Behavior:**
- `postJournalEntry(entry, lines)` → validate debits === credits (paise); return `{ ok, entry, lines }` or `BALANCE_MISMATCH`.
- `reverseJournalEntry(entry, reason)` → create reversal entry with opposite signs; link to original.
- `trialBalance(accounts, entries)` → per-account debit/credit totals; net balance; zero-balance filter.
- `pnl(accounts, entries, revenueCodes, expenseCodes)` → revenue total, expense total, net profit.
- `balanceSheet(accounts, entries, assetCodes, liabilityCodes, equityCodes)` → assets, liabilities, equity, check balance.

**Tests (~25):** journal posting balance check; reversal; trial balance; P&L; balance sheet; paise integrity.

---

### Task C6-4: Finance engines — treasury + fixed assets (pure, TDD)
**Files:** `src/lib/finance/treasury.ts`, `src/lib/finance/fixedAssets.ts` (v2 wrapper), `tests/financeTreasury.test.ts`, `tests/financeFixedAssets.test.ts`.

**Behavior:**
- `reconcileBank(statement, entries)` → matched, unmatchedStatement, unmatchedBook; amount tolerance.
- `nextChequeNumber()` → `CHQ-YYYY-NNN` format.
- `monthDepreciation(asset, period, accumulated)` → reuse v1 logic, wrap in v2 types.
- `generateSchedule(asset, upToPeriod)` → reuse v1 logic, wrap in v2 types.

**Tests (~15):** bank reconciliation match/unmatch; cheque numbering; depreciation SL/WDV; schedule generation.

---

### Task C6-5: Typed adapters + `/api/v2/commercial/*` + `/api/v2/finance/*` routes
**Files:**
- `src/lib/commercial/commercialTx.ts`
- `src/lib/finance/financeTx.ts`
- `src/app/api/v2/commercial/quotations/route.ts`
- `src/app/api/v2/commercial/sales-orders/route.ts`
- `src/app/api/v2/commercial/dispatch/route.ts`
- `src/app/api/v2/commercial/invoices/route.ts`
- `src/app/api/v2/commercial/payments/route.ts`
- `src/app/api/v2/finance/gl/route.ts`
- `src/app/api/v2/finance/treasury/route.ts`
- `src/app/api/v2/finance/fixed-assets/route.ts`

**Pattern per route:** zod schema → `parseOr400` → authz (`commercial.edit` / `finance.edit` / `commercial.approve` / `finance.approve`) → adapter call → `toApiError` mapping. In-tx audit via `buildAuditEvent`. Idempotency via `runIdempotent` where clientId present.

**Permissions:**
- `commercial.view` — read quotes/SOs/dispatch/invoices/payments
- `commercial.edit` — create/update quotes/SOs/dispatch
- `commercial.approve` — approve quotes/SOs above threshold; mark won/lost
- `finance.view` — read GL, trial balance, treasury, fixed assets
- `finance.edit` — create journal entries, post payments
- `finance.approve` — approve journal entries, bank reconciliations

---

### Task C6-6: Cycle 6 verification gate
1. All new suites green; whole repo `tsc --noEmit` exit 0; `grep -rn "as any" src/lib/commercial src/app/api/v2/commercial src/lib/finance src/app/api/v2/finance` → none.
2. Parity checklist vs DEPTH_03 F6/F7 + DEPTH_04 W1/W8/W9 state machines + guardrails (paise integrity, balanced GL, reversals, audit).
3. Real-DB smoke on scratch `mfgmax_v2_test`: create quote → SENT → WON → convert to SO → CONFIRMED → IN_PROGRESS → dispatch → invoice → payment; GL journal balanced; trial balance matches.
4. Mark this plan COMPLETE with evidence + boundaries.

---

## 4. Verification commands

```bash
npm test
npx tsc --noEmit
grep -rn "as any" src/lib/commercial src/app/api/v2/commercial src/lib/finance src/app/api/v2/finance || echo "clean"
```

---

## 5. Out of scope (later cycles / tier-3)

Credit/debit notes + returns, petty cash, sales quota/commission, IRN/GSTR-1/3B exports, TDS tracker, contract expiry alerts.

---

*Next: execute C6-1 through C6-6 in order.*
