# Manufacturing Max v2 — Remaining Cycles & Gap Closure Roadmap

> **Audience:** executing agent on branch `v2`. TDD every task, verification-before-completion, no `as any`. Each cycle builds on the typed core and org-model spine from C1.

**Goal:** Close the gap between the current v2 state (C1–C5 complete) and the DEPTH_01 vision: deterministic engines for every major domain, guardrails enforced in code, org-driven approval routing, and a local AI copilot framework — while filling the highest-value tier-2/3 org gaps.

**Current date:** 2026-09-05.

---

## 1. Completed foundation (already landed)

| Cycle | Status | Evidence |
|---|---|---|
| C1 Typed core + org model + auth | ✅ | 40 tests, `tsc --noEmit` clean |
| C2 Shop-floor MES core | ✅ | 40 tests, WO/terminal/idempotency |
| C3 Quality & aero compliance | ✅ | 33 tests, FAI/NCR/8D/data-package + guardrails G-1..G-6 |
| C4 Engineering & change control | ✅ | 21 tests, ECO/revision/document rev + G-5 |
| C5 Supply chain & purchasing | ✅ | 45 tests, PO/receipt/stock/subcontract + cert gating |

**Total:** 134+ tests across 22 suites; real-DB smoke passed on scratch `mfgmax_v2_test`.

---

## 2. Remaining rebuild cycles (C6–C13)

Execute in order. No parallel cycles on `v2` without separate worktrees.

### C6 — Commercial & Finance Core
**Spec anchor:** DEPTH_03 F6/F7, DEPTH_04 W1/W8/W9  
**Primary risk:** paise money end-to-end, balanced GL, quote→SO→dispatch→invoice integrity

**Scope:**
- Quotation → SalesOrder → DispatchRecord → Invoice → Payment state machines
- Double-entry GL posting with integer paise (`money.ts`), journal reversals
- Trial balance / P&L / balance sheet engines
- GST reconciliation, fixed assets + depreciation, treasury + bank reconciliation
- Maker-checker voucher flow

**Out of scope:** credit/debit notes + returns (tier-3), petty cash (tier-3), sales quota/commission (tier-3), IRN/GSTR-1/3B exports (tier-3)

**Tasks:**
1. `src/lib/commercial/quotations.ts` — quote state machine + line costing
2. `src/lib/commercial/salesOrders.ts` — SO→dispatch→invoice transitions
3. `src/lib/finance/glCore.ts` + `glPosting.ts` — journal lines, reversals, integrity
4. `src/lib/finance/treasury.ts` — bank recon + payment sequencing
5. `src/lib/finance/fixedAssets.ts` — depreciation schedules
6. Adapter + `/api/v2/commercial/*` + `/api/v2/finance/*` routes
7. DB smoke + cycle gate

---

### C7 — People & Payroll
**Spec anchor:** DEPTH_03 F8, DEPTH_04 W10  
**Primary risk:** statutory correctness, session-rotation safety, overtime guardrails

**Scope:**
- Attendance + leave + roster + shift allowance
- Overtime computation with daily threshold + statutory limit
- Payroll run → payslip → statutory challans (PF/ESI/PT)
- Performance appraisal linkage
- Training effectiveness + expiry alerts

**Out of scope:** gratuity provisioning (tier-3), employee loans/advances (tier-3), succession planning (tier-2), policy acknowledgement tracking (tier-2), credential expiry (tier-4)

**Tasks:**
1. `src/lib/people/attendance.ts` — attendance + leave + roster engines
2. `src/lib/people/overtime.ts` — OT computation + limits
3. `src/lib/payroll/payrollEngine.ts` — payroll run + payslip + challans
4. `src/lib/people/training.ts` — training effectiveness + expiry
5. Adapter + `/api/v2/people/*` + `/api/v2/payroll/*` routes
6. DB smoke + cycle gate

---

### C8 — Maintenance & Tooling
**Spec anchor:** DEPTH_03 F9, DEPTH_04 W11  
**Primary risk:** calibration-expired instruments blocked from inspection (G-4), tool-life gates

**Scope:**
- PM schedules + breakdown jobs + MTBF/MTTR
- Permit-to-work gates
- Tool crib + calibrated tool registry + tool-life tracking
- Spare parts + predictive maintenance RUL engine
- Maintenance checklist + audit trail

**Out of scope:** reliability metrics dashboard polish, advanced vibration/thermal/oil analysis (already partially modeled)

**Tasks:**
1. `src/lib/maintenance/pm.ts` — PM triggers + breakdown RCA gate
2. `src/lib/maintenance/toolLife.ts` — tool-life + calibrated-tool gates
3. `src/lib/maintenance/predictive.ts` — RUL engine stub + model runs
4. Adapter + `/api/v2/maintenance/*` routes
5. DB smoke + cycle gate

---

### C9 — EHS, Lean & Continuous Improvement
**Spec anchor:** DEPTH_03 F10/F11  
**Primary risk:** incident closure evidence, near-miss quota enforcement

**Scope:**
- Safety incidents + audits + observations + PPE + extinguishers + haz-waste
- Near-miss quota + safety training records
- 5S/Kaizen/improvement project tracking
- RCA records + action items
- Environmental permits + carbon emissions

**Out of scope:** POSH/ICC (tier-4), accident register with LTI (tier-4)

**Tasks:**
1. `src/lib/ehs/safety.ts` — incident + audit + observation engines
2. `src/lib/ehs/lean.ts` — 5S + Kaizen + improvement projects
3. Adapter + `/api/v2/ehs/*` routes
4. DB smoke + cycle gate

---

### C10 — Reports, Digest & Print Center
**Spec anchor:** DEPTH_03 F1/F12 reports  
**Primary risk:** print fidelity, digest completeness, command-center performance

**Scope:**
- Unified report engine (print-friendly, PDF-ready)
- Digest/bell aggregation across all domains
- Executive briefing pack + board pack
- Command-center dashboard refactor to typed fetchers
- S&OP-lite, price-revision, follow-up cadence (already built; ensure v2 parity)

**Tasks:**
1. `src/lib/reports/reportEngine.ts` — typed report DTOs + print formatting
2. `src/lib/digest/digestEngine.ts` — domain-agnostic digest aggregation
3. Refactor `src/app/command/page.tsx` to remove `Promise.all` bloat; introduce parallel typed fetchers with caching
4. `/reports/*` routes + print center
5. DB smoke + cycle gate

---

### C11 — AI Copilot Framework
**Spec anchor:** DEPTH_05, DEPTH_01 AI-1/2/3  
**Primary risk:** AI-2 enforcement — no autonomous mutations; human approval + audit

**Scope:**
- Seat-aware context assembly (org model + plant data + role)
- Local model gateway (`llmGateway.ts`) hardened as default path
- Approval broker: AI drafts → human approves → audited action
- Per-seat copilot surfaces (assist, explain, draft, prepare)
- Deterministic-engine-first rule: LLM never overrides engine output

**Out of scope:** cloud-model integrations, generic chat surface

**Tasks:**
1. `src/lib/ai/seatContext.ts` — org-aware context assembly
2. `src/lib/ai/approvalBroker.ts` — draft/approval/audit state machine
3. `src/lib/ai/copilotRegistry.ts` — per-seat copilot registration
4. `/api/v2/ai/*` routes + `/ai/assistant` UI refactor
5. DB smoke + cycle gate

---

### C12 — System/Admin + Custom Entities + Org-Chart Admin
**Spec anchor:** DEPTH_02 §7, DEPTH_03 F12/F13  
**Primary risk:** admin UX completeness, approval-chain UI, acting coverage

**Scope:**
- Org chart + reporting lines + RACI register UI
- Approval-chain admin + seat coverage management
- Custom entity/field/record admin (`CustomEntity/CustomField/CustomRecord`)
- Settings UI overhaul (typed config instead of key-value strings)
- Access review + restore drills UI

**Tasks:**
1. `src/lib/org/orgChart.ts` — reporting line + RACI engines
2. `src/lib/org/approvalChainAdmin.ts` — chain CRUD + seat assignment
3. `src/lib/settings/typedConfig.ts` — typed settings schema replacing string map
4. `/system/org-chart`, `/system/approval-chains`, `/system/custom-entities` routes
5. DB smoke + cycle gate

---

### C13 — Plant-Server Scale + Desktop Integration + Go-Live Hardening
**Spec anchor:** DEPTH_06  
**Primary risk:** 500+ user claims, installer hardening, backup/restore drills

**Scope:**
- Performance benchmarking under load (seed 1,000+ machines, 500+ concurrent users)
- DB connection pooling + query optimization pass
- Desktop launcher hardening: watchdog improvements, backup/integrity automation
- Customer-connect export formats (ASN/portal extracts)
- E-invoice IRN + GSTR-1/3B exports (tier-3, deferred to post-C13 if needed)

**Tasks:**
1. Load-test script + benchmark report
2. Prisma query optimization pass (add missing indexes, batch includes)
3. Desktop hardening: `desktop/lib/*` review + fixes
4. Export formats: ASN, sales register, e-invoice stub
5. Go-live runbook + restore drill verification

---

## 3. Tier-2 Gap Closure (integrate into C6–C12 where possible)

| # | Gap | Recommended Cycle | Rationale |
|---|---|---|---|
| 1 | Org chart + RACI / reporting lines | C12 | Already scoped in C12 |
| 2 | Exit / offboarding management | C7 | People cycle; natural extension |
| 3 | Supplier audits | C5 follow-up | Supply chain already active; add `SupplierAudit` + digest |
| 4 | CSAT / voice of customer | C6 follow-up | Commercial cycle; extend `CustomerComplaint` |
| 5 | TDS compliance tracker | C6 follow-up | Finance cycle; extend payroll challans |
| 6 | Succession planning / key-man | C12 | Org chart cycle |
| 7 | Management of Change (MOC) | C4 follow-up | ECO engine exists; broaden scope |
| 8 | Policy acknowledgement tracking | C12 | Org/custom-entities cycle |
| 9 | Whistleblower / anonymous ethics | C7 follow-up | People/HR cycle |
| 10 | Visitor / gate management | C5 follow-up | Supply/security cycle |
| 11 | Contract expiry + milestone alerts | C6 follow-up | Commercial cycle |

**Action:** Add these as sub-tasks to the owning cycles above. Do not defer them to a separate wave.

---

## 4. Tier-3 Gap Closure (deferred beyond C13)

These are verified-absent high-value items. Sequence after C13 in a “v2 completeness” pass:

1. Credit/debit notes + sales & purchase returns
2. CSR matrix (customer-specific requirements)
3. Skill/competency matrix + SOP acknowledgements
4. Gratuity provisioning
5. Employee loans & advances
6. Petty cash register
7. GST e-invoice (IRN) + GSTR-1/3B returns
8. Board resolutions + related-party transaction registers
9. Password policy enforcement
10. Cheque/payment-instrument register
11. Insurance claims lifecycle
12. Sales quota & commission

---

## 5. Sequencing Rules

1. **One cycle at a time** on `v2`. A cycle may split into `C6a`/`C6b` if large.
2. **Cycle definition of done:** schema valid + tests green + `tsc --noEmit` clean + DEPTH cross-ref note + real-DB smoke.
3. **No prototype deletion** until the v2 replacement passes parity review and the user approves.
4. **Org spine first:** every new scoped query must resolve through the seat/org resolver; never hardcode plant/unit filters.
5. **Guardrails enforced in engines/routes, never UI only.**
6. **Money and audit:** use `money.ts` for all currency; use `audit.ts` for all mutations.

---

## 6. Next Action

Start **C6 — Commercial & Finance Core** immediately after this plan is accepted. The C6 plan doc should be created as `docs/plans/2026-09-05-cycle6-commercial-finance.md` with task breakdown, tests, and verification gates.
