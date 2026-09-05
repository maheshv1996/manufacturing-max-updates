# DEPTH 03 — Features by Department

**Status:** Authoritative module surface. Companion docs: `DEPTH_01` (pillars/guardrails), `DEPTH_02` (org/roles), `DEPTH_04` (workflow spine W1–W12), `DEPTH_05` (AI), `DEPTH_06` (real-world).
**How to read:** each department lists its **feature families**; per family: what it does · primary seats · key records (schema models) · config vs guardrail · AI touchpoint · where it lives in the code (route dirs / `src/lib` engines). Depth of a *flow* is in `DEPTH_04`; this doc is the complete inventory so nothing is invisible.

Module enable/disable follows the org's `activeDepartments` Setting (a plant that does no subcontracting hides that surface) — org model governs who sees what.

---

## F1. Executive & Cross-Department (workspace `exec`)

**Feature families.**
- **Command dashboard (`/command`)** — plant OEE, production, live machine grid (RUNNING/DOWN/IDLE), revenue/cost/margin for the month (live job costing), receivables aging, payables, low-stock alerts, energy cost/run-hour, certification & vendor expiry, compliance flags (as9100-relevant), program health, complaint SLA breaches + at-risk programs as exec strips. Saved per-user prefs + date-range.
- **Morning digest (`/digest`, `digestData.ts`)** — overnight summary: what changed, what's due, what breached; plant-local timezone aware (`plantTz`).
- **Command palette (Ctrl/Cmd+K)** — fuzzy jump across modules/WOs/machines.
- **Notification bell** — grouped Critical/Action/Info; per-role routing.
- **Reports center (`/reports`)** — print-first layouts: job profitability, stock register, inventory valuation, material readiness, PO register & supplier scorecard, maintenance register, OT & statutory compliance, morning meeting pack, daily production, downtime, performance/OEE matrix, job traveler & routing card, 5S sheet, sales register (GST), receivables aging, leaderboard, compliance digest.
- **Print system** — CSS `@media print`, print button; traveler/challan/invoice/payslip layouts.

**Key records:** `Setting`, `AnalystQuery`, `ComplianceDigestLog`, `NotificationRead`, `AuditLog`, `Override`, `MrmMeeting/MrmActionItem`.
**Config vs guardrail:** KPI targets, digest contents, report sets = configurable; printed legal docs (invoice/challan) frozen formats + no-delete (G-7/G-8).
**AI:** exec digest copilot ("what changed overnight", anomaly explanations); analyst chat over plant data (`/analyst`, `analystEngine.ts`); AURA `/ai/cortex`.
**Code anchors:** `/command`, `/digest`, `/reports`, `/analyst`, `/system/escalations`, `/people/leaderboard`, `src/lib/{data,digestData,leaderboardData,complianceDigest,programHealth,costingEngine,complaintSla}.ts`.

---

## F2. Shop Floor MES & Operator Terminal (workspace `ops` + `terminal.use`)

> **C2 implementation status (2026-09-05, branch `v2`):** the typed **state core** is implemented — `src/lib/shopfloor/{woState,eventLedger,readiness,routing,shiftCount}.ts` (pure, TDD: 40 tests) + DB adapter `applyJobAction.ts` + `/api/v2/shopfloor/{action,readiness}` routes, smoke-tested end-to-end on a real Postgres (fixture gate + override, G-1 FAI gate, idempotent logs, downtime, short-closure authority). The operator **terminal UI**, andon, SPC, capacity, tool-life decrement and serial capture remain v1 surfaces / later cycles (see `docs/plans/2026-09-05-cycle2-shopfloor-mes.md`).

**Feature families.**
- **Operator terminal (`/terminal`)** — touch-first (48px+ targets), badge/employee-number login, machine+WO selection, START/END job, +1 Good/Scrap/Rework (defect code), downtime with reason/category, My Queue, My Roster strip, idea submit, quick safety log, IPQC checklists on floor, fixture + stale-rev pills, tool-wear widget, shift-count card (W2). Multilingual EN/TE/HI.
- **Offline action queue** — `offlineSync.ts` localStorage queue + `X-Client-ID` idempotency replay (G-9).
- **Andon board (`/ops/andon`)** — live wall board: machine states, job progress, hour targets vs actual, maintenance calls.
- **Machine radar & IoT (`/system/machines`, `/iot`)** — machine registry (cycle times), state telemetry, energy readings, IoT simulator/MQTT gateway hooks and client surfaces under `/iot`/`/factoryplus` (showcase breadth today; IIoT protocol persistence models are roadmap), auto-downtime injection on anomaly (config-gated), CNC tool-offset feeds (registry planned).
- **SPC (`/ops/spc`, `spcEngine.ts`)** — control charts from sample measurements vs USL/LSL, signals (X-bar/R), capability.
- **Schedule & capacity (`/ops/schedule`, `/ops/capacity`, `capacityEngine.ts`)** — Gantt-like WO board across machines; load vs capacity; drag re-sequence (priority); S&OP-lite decisions (OT/outsource/extra shift auto-create follow-ups: `SopDecision`, `CapacityWindow`).
- **Voice terminal (`/ops/voice`)** — hands-free piece clocking and lookups (voice synthesis/recognition hooks, sound FX).
- **Packaging/kiosk** — `PackagingScanLog`, EAN scan of finished serials at pack; kiosk mode + LAN token gate.
- **Production logs & reconciliation** — `ProductionLog/DowntimeLog/MovementLog`, `/reconcile` shift WIP and material-vs-output balancing; `Logsheet` for manual sheets.

**Key records:** `Machine, WorkOrder, ProductionLog, DowntimeLog, DefectCode, ShiftCount, ShiftHandover, ShiftRoster/RosterEntry, Assignment(Override), MovementLog, ToolLifeLog` (OEE/quality KPIs derived from these logs).
**Config vs guardrail:** shift windows, downtime categories, tolerance, machine groups, SPC limits per param, IoT anomaly rules, kiosk token, roster rules = configurable; idempotent logs (G-9), no-delete logs (G-7), calibration/fixture/rev gates before start = guardrails.
**AI:** operator seat copilot (next-action, translation + voice, defect guidance, downtime narrative) — spec in DEPTH_05 §6.2.
**Code anchors:** `/terminal`, `/ops/*`, `/api/operator/*`, `/api/terminal/*`, `/api/attendance/clock`, `/api/ipcc`, `/api/andon`, `src/lib/{data,otEngine,spcEngine,capacityEngine,cncEngine,offlineSync}.ts`.

---

## F3. Quality, Metrology & Compliance (workspaces `quality`, `metrology`)

> **C3 implementation status (2026-09-05, branch `v2`):** the compliance **state core** is implemented — `src/lib/quality/{ncrState,eightD,fai,dataPackage,complaintSla}.ts` (pure, TDD: 33 tests) + typed adapter `qualityTx.ts` + routes `/api/v2/quality/{ncr,eight-d,fai,data-package}/*`, smoke-tested end-to-end on a real Postgres. Guardrails enforced server-side: G-3 (8D closure needs D4–D7 evidence + review), G-6 (released package frozen/newRevision), disposition authority incl. USE_AS_IS customer concession; G-1's FAI gate was already live in the C2 shopfloor adapter; G-2's hold-point rule in `routing.ts`. Remaining v1 surfaces/later cycles: genealogy UI, calibration G-4 wiring, PPAP, MRM (see `docs/plans/2026-09-05-cycle3-quality-compliance.md`).

**Feature families.**
- **Serial & lot genealogy (`/quality/genealogy`)** — 6-stage thread (mill heat → machining → subcontract → FAI → packaging → dispatch) via `SerialUnit/SerialEvent`; batch or serial tracking per product (`TrackingMode`).
- **FAI AS9102 (`/fai`)** — Form 1/2/3, characteristic ballooning, deviations & approvals (W6); `FaiReport/FaiCharacteristic`.
- **NCR / MRB / CAPA (`/quality/ncr`, `/mrb`)** — disposition workflow (W5); `NcrReport` statuses + `ScrapQuarantine`, `ReworkOrder`, `WriteOffRequest`.
- **8D & complaints (`/quality/eight-d`, `/complaints`)** — D1–D8 state machine with containment ActionItems; complaint SLA 24h ack / 10d 8D (G-3); supplier SCAR path.
- **Hold points (`/quality/hold-points`)** — routing-step sign-offs (G-2).
- **Data packages (`/data-package`)** — assemble dossier → RELEASED frozen (G-6).
- **Mill certs & material traceability** — `MaterialCert` per lot/IN transaction; `requireMillCerts` gate; cert registry + validity.
- **Calibration lab (`/quality/calibration`, `CalLabRequisition`)** — instrument registry, due dates, vendor ratings, recall scope (G-4); `GageRnrStudy` (GRR).
- **FQC / IPQC / AQL** — incoming/process/in-process checklists (`FqcChecklist`, `AqlPlan`, `IpccChecklistRun/IpccCheckResult`), control plans.
- **PPAP & control plans (IATF-facing surface)** — `PpapSubmission/PpapElement`, `ControlPlan` (starter depth; automotive module extends).
- **Quality objectives & MRM** — `QualityObjective` (milestone tracking; standalone `ObjectiveMilestone` model = roadmap), MRM agenda built from open NCRs/risks/complaints (`MrmMeeting`/`MrmActionItem`).

**Key records:** F3 list above + `EightDReport` (D1–D8 sections as structured fields over `EightDStatus`), `CapaAction`, `CustomerScorecard`.
**Config vs guardrail:** severity matrix, MRB authority per disposition, FAI characteristic set, AQL plan, cert requirements per part class = configurable; G-1…G-6 guardrails all bind here (FAI gate, hold points, 8D evidence, calibration validity, frozen packages).
**AI:** quality/compliance copilot — 8D drafting, FAI prep, NCR triage briefs, deviation explanations, SCAR composition (DEPTH_05 §6.3).
**Code anchors:** `/quality`, `/fai`, `/mrb`, `/complaints`, `/metrology`, `/quality/mrm`, `/api/{fai,ncr,eight-d,hold-points,ipcc,calibration,data-package,grr}*`, `src/lib/{grr,spcEngine,mrbPolicy,complaintSla,calibration}.ts`.

---

## F4. Engineering & Configuration Management (workspace `engineering`)

> **C4 implementation status (2026-09-05, branch `v2`):** the change-control **state core** is implemented — `src/lib/change/{eco,revision,documentRev}.ts` (pure, TDD: 21 tests) + adapter `changeTx.ts` + routes `/api/v2/change/{eco,eco/action,documents}`, smoke-tested on a real Postgres. G-5 enforced structurally (IMPLEMENTED only from APPROVED with recorded effectivity); revision law: floor may only use the current revision (`revisionGap` feeds C2-3's `DRAWING_REV`), superseded document rows are ARCHIVED, never deleted. Remaining v1 surfaces/later cycles: file storage/streaming, transmittal, fixture register, CNC registry (see `docs/plans/2026-09-05-cycle4-change-control.md`).

**Feature families.**
- **Product master & BOM** — `Product`, multi-level `BomLine`, cost explosion (material+machining+tooling = standard cost).
- **Routing & operations** — `Operation/RoutingStep` with sequence, setup/cycle times, hold-point flags, machine/line assignment; standard time basis for estimating/capacity/SPC.
- **Drawings & documents** — `Document` (revision-controlled, DB-bytes file storage, streaming download), `DrawingTransmittal` (issue/ack), archive of superseded revisions.
- **ECO/ECN** — full W7 change control; `Eco/EcoItem`, effectivity, visual Rev diff, approvals; consequence engine (floor + suppliers).
- **Fixtures & tooling register** — `Fixture` status; mandatory WO start gate if fixture required.
- **CNC calculators & programs** — speed/feed/power/surface-finish calculator (`cncEngine`); CNC program/tool-offset registry is planned (no dedicated model yet).
- **Custom part metadata** — org fields via `CustomEntity` where the built-in product model doesn't fit.

**Key records:** `Product, BomLine, Operation, RoutingStep, Document, Eco, EcoItem, Fixture, DrawingTransmittal`.
**Config vs guardrail:** routing templates, doc types, ECO approval seats, CNC tool DB = configurable; ECO law (G-5), drawing-rev-on-floor (obsolete rev blocked), doc no-delete/archive = guardrails.
**AI:** engineering copilot — ECO impact drafts, BOM/route explainers, doc-rev lookups, fixture/cert readiness answers.
**Code anchors:** `/engineering`, `/eco`, `/rnd`, `/projects`, `/api/eco*`, `/api/docs/[id]/file`, `src/lib/{cncEngine,seqNumbers}.ts`.

---

## F5. Supply Chain, Inventory & Purchasing (workspace `supply`)

> **C5 implementation status (2026-09-05, branch `v2`):** the supply-chain **state core** is implemented — `src/lib/supply/{po,receipt,inventory,subcontract}.ts` (pure, TDD: 45 tests) + typed adapter `supplyTx.ts` + routes `/api/v2/supply/{po,receipt,cycle-count,subcontract}/*`, smoke-tested end-to-end on a real Postgres (approval ladder incl. manager/owner escalation, W3 cert gate — receipt without a linked cert is blocked when `requireMillCerts` is on — double-receipt guard, over-delivery tolerance, atomic stock posting, W12 cycle-count variance → authorized adjust, W4 accredited-scope + special-process cert gates, FAIL signoff routes an NCR). `QC_FAILED` added to `SubcontractStatus`. Remaining v1 surfaces/later cycles: MRP/BOM explosion, comparative statements & rate contracts, supplier scorecard engine, write-off GL, freight/telematics, supplier portal/ASN, three-way match with invoices (C6) (see `docs/plans/2026-09-05-cycle5-supply-chain.md`).

**Feature families.**
- **Inventory & vault (`/supply/vault`)** — SKU/raw-material registry, bin locations, IN/OUT/ADJUST ledger w/ reason + lot + cert, min-stock alerts, ABC classes, valuation, `MaterialIssueSlip`.
- **MRP (`/supply/mrp`, `mrpEngine.ts`)** — explode open WO demand vs stock + in-flight POs; requisition generation; BOM-depth cycle guard.
- **Purchasing** — `PurchaseOrder/PO Line` statuses (ORDERED/PARTIAL/RECEIVED), GRN one-click receipt → IN transactions + PO status (W3), comparative statements & rate contracts, follow-up log.
- **Supplier management** — master with approvals, scorecards (`SupplierScorecard`: OTIF/quality/price), special-process accreditation (`SpecialProcessVendor`), supplier 8D/SCAR tracking.
- **Subcontracting** — `SubcontractChallan` outward/inward w/ accredited scope + QC signoff (W4).
- **Cycle counts** — `CycleCountSession/Line` ABC schedule → variance → approved ADJUST (W12).
- **Write-offs** — `WriteOffRequest/Line` (MRB-linked) with value to GL.
- **Freight & logistics** — `FreightVendor/FreightDispatch`, GPS fleet radar surface (telematics hooks).

**Key records:** `RawMaterial, InventoryTransaction, BinLocation, Supplier, PurchaseOrder/Line, PurchaseRequisition, GoodsReceiptNote/Line, MaterialCert, SupplierScorecard, SpecialProcessVendor, SubcontractChallan, CycleCountSession/Line, MaterialIssueSlip, WriteOffRequest/Line, RateContract, ComparativeStatement/Quote, FreightVendor/FreightDispatch, SupplierInvoice, SupplierPayment, PoFollowUpLog`.
**Config vs guardrail:** approval tiers, cert requirement flags, bin scheme, ABC cadence, subcontract vendor lists, freight incoterms = configurable; atomic stock updates, idempotent GRN, no-delete movements, cert-before-use for tracked material (G-adjacent), accredited-scope gating = guardrails.
**AI:** purchasing copilot — draft requisitions from MRP, supplier risk briefs, GRN disposition drafts, cert-status answers, variance explanations.
**Code anchors:** `/supply/*`, `/api/{purchasing,grn,inventory,material-issue,cycle-count,write-off,subcontracting,comparative,rate-contract,freight,register}*`, `src/lib/{mrpEngine,readinessEngine,poApproval,poLines,importConfig,sourceRecordEdit}.ts`.

---

## F6. Commercial, Sales & CRM (workspace `commercial`)

**Feature families.**
- **Leads & CRM** — `Lead` pipeline, opportunities, follow-ups, win/loss capture.
- **Customers** — master w/ contacts (`CustomerContact`), credit limits (paise), CSRs per customer (matrix; aerospace customer-specific requirements), scorecards.
- **Quotations & estimating** — W1 quote flow, live estimate from BOM/routing/rates (`estimatingEngine`), loss-bid safeguard, 1-click WON → SO + WO conversion.
- **Sales orders** — `SalesOrder/Line`, promised dispatch dates, amendment history, contract links (`Contract`).
- **Dispatch & invoicing** — `DispatchRecord`, one-invoice-per-dispatch, GST tax engine (INTRA CGST/SGST, INTER IGST), Indian number-to-words totals, credit/debit notes (planned), e-invoice IRN (planned).
- **Payments & aging** — `Payment/PaymentRecord/PaymentMethod`, partials, allocation rule, receivables aging report, collections (`/commercial/collections`).
- **Marketing/landing** — public landing + lead capture (`Lead`), campaign tracking (`MarketingCampaign`).

**Key records:** F6 list + `Quotation/QuotationLine, QuotationStatus, Invoice/InvoiceLine, DispatchRecord, EximShipment (Incoterms), CustomerScorecard, PriceRevision`.
**Config vs guardrail:** quote approval threshold, tax profile, credit terms, invoice numbering, aging buckets = configurable; one-invoice-per-dispatch (G-adjacent), paise money, no-delete financial docs, balanced GL (G-7/G-8) = guardrails.
**AI:** commercial copilot — draft quote/proposal text, margin explainers, amendment drafts, aging/collections priorities, CSR applicability checks.
**Code anchors:** `/commercial/*`, `/api/{quotations,sales-orders,invoices,payments,dispatch,comparative,price-revisions,marketing}*`, `src/lib/{quotations,estimatingEngine,salesOrderPolicy,salesOrders,costingEngine,winLoss,voucherNumbers,money}.ts`.

---

## F7. Finance, GL & Treasury (workspace `finance`)

**Feature families.**
- **Chart of accounts & GL** — `GlAccount`, double-entry posting engine (`glPosting/glEngine`), integer paise everywhere (`money.ts`), fiscal periods (`FiscalPeriod`).
- **Operational-document posting** — invoices/payments/expense/payroll/PO-GRN post with provenance; `glBackfill` replays missing docs idempotently.
- **Integrity & provenance** — daily 02:30 sweep (`glIntegrity`), `GlIntegrityRun` records, finance-hub banner, `/finance/gl-backfill` workbench.
- **Job costing** — WO live cost rollup (material+labor+overhead+energy+tooling) vs estimate; margin analytics (ties to `/command` month margin).
- **Treasury & bank** — `TreasuryTransaction`, `BankStatementEntry` (statement ingest) + bank-reconciliation module, GSTR-1/3B orientation + `GstReconRun` (`BankAccount`/`BankTransaction` masters = roadmap).
- **Fixed assets** — `FixedAsset`, depreciation entries (`AssetDepreciationEntry`), asset register.
- **Payables/expenses** — `SupplierInvoice`, `ExpenseClaim/Item`, petty cash (planned), payment runs.
- **Cost centers & budgets** — `BudgetLine` burn vs budget; full cost-center master + allocation model = roadmap.
- **Risks (governance)** — `RiskRegister` L×I scoring, review cadence, digest/MRM feed (finance-adjacent org governance).

**Key records:** F7 list + `Voucher`, `JournalEntry/JournalLine`, `GlIntegrityRun`, `PayrollRun/Payslip` posting links, `GstReconRun`.
**Config vs guardrail:** account mapping, fiscal calendar, approval tiers, cost-center structure, risk review cadence = configurable; balanced journals, paise exactness, provenance, no silent correction, sweep-on-schedule = guardrails (G-8; DEPTH_01 §8 snapshot).
**AI:** finance copilot — anomaly explainer, backfill/recon suggestions, month-end commentary, risk-review drafting.
**Code anchors:** `/finance/*` (hub, gl-backfill, costing, treasury…), `/api/finance/*`, `src/lib/{glCore,glPosting,glEngine,glBackfill,glIntegrity,money,fixedAssets,payrollEngine,costingEngine,riskRegister}.ts`, `desktop/lib/ledgerIntegrity.js`.

---

## F8. People, HR & Payroll (workspace `people`)

**Feature families.**
- **Employees & org** — `Employee` HR record (joined by employeeNumber to `User`), departments/designations (to be superseded by DEPTH_02 units), multi-role assignments (planned, DEPTH_02 §7).
- **Attendance & time office** — clock in/out (badge/device), shifts & roster, `AttendanceLog`/`AttendanceDevice`, leave requests with approval (`LeaveRequest`, running balance computed; balance ledger = roadmap), overtime (`OvertimeRequest`) + statutory cap flags.
- **Payroll** — `SalaryStructure`, monthly `PayrollRun` → `Payslip` (attendance + OT + statutory PF/ESI), statutory registers & contributions, CSV exports for accounting.
- **Training & skills** — `TrainingProgram/Attendance`, `Certification` (operator certs with expiry — safety gate on floor), skill matrix (planned depth).
- **Performance & HR ops** — `PerformanceAppraisal`, grievances, disciplinary cases, recruitment (`JobRequisition/Candidate/Interview`), onboarding tasks, access reviews (`AccessReviewCycle/AccessCertification`), contractor & contract labour (`Contractor/ContractLabourRecord`).
- **Leaderboard & recognition** — gamified operator leaderboard (scrap/efficiency), lean contributors.

**Key records:** F8 list + `LeaveRequest`, `OvertimeRequest`, `PayrollRun/Payslip`, `SalaryStructure`, `StatutoryContribution`.
**Config vs guardrail:** shift windows, leave policy, OT multipliers, salary components, payroll cut-off = configurable; statutory caps & contributions, session rotation on grant/revoke (SEC-3), access-review cadence = guardrails.
**AI:** HR copilot — policy Q&A, role-grant summaries, payroll exception explainers, expiring-cert digest, exit-checklist drafts.
**Code anchors:** `/people/*`, `/api/{attendance,leaves,overtime,payroll,roster,training,certifications,appraisals,access-review,recruitment}*`, `src/lib/{payrollEngine,employeeLookup,attendanceLogic…}.ts`, `prisma/seed-rbac.ts`.

> **v2 rebuild status (C7 COMPLETE, 2026-09-05):** the people/payroll **state core** is rebuilt DB-proven on `v2` — pure engines `src/lib/people/{employees,attendance,leaves,payroll}.ts` + `src/lib/sessionRotation.ts` (TDD: 12 tests), typed adapter `src/lib/people/peopleTx.ts` (engine-gated, in-tx audits), routes `/api/v2/people/{employees,attendance,leaves,leaves/[id]/action,payroll,payroll/[month]/run}`. `LeaveStatus` gained `CANCELLED`; `LeaveType` gained `MATERNITY|PATERNITY|COMP_OFF`; payslips now carry engine-computed `lopDays`+`lopDeduction`. Real-DB smoke (`npm run test:c7-6`, CI-wired): employee→attendance(26P/2L)→leave approve/cancel/reject→payroll run with LOP integrity→idempotent re-run→audits→session-rotation round-trip, 14/14 green.

---

## F9. Maintenance, Reliability & Tooling (workspace `maintenance`)

**Feature families.**
- **Maintenance jobs** — breakdown/PM (W11), priorities, root cause, cost + labor hours to job costing; `MaintenanceJob`.
- **PM rules** — calendar/run-hour/cycle triggers (`PMRule`) auto-scheduling jobs.
- **Spares & kits** — `SparePart/SpareKit(Item)` stock, issue to jobs, reorder at min.
- **Predictive/reliability** — MTBF/MTTR analytics and reliability kanban from `MaintenanceJob` history; vibration/RUL predictive-model records = roadmap (raw telemetry via `TelemetryLog`).
- **Tooling** — `Tool/CalibratedTool`, tool life decrement on cycles, wear % warning, mandatory replace, tool-room issue (`ToolLifeLog`, `InstrumentIssue`, `MaintenanceTool`).
- **Metrology instruments** — instrument registry + cal recalls (with F3 cal lab).

**Key records:** F9 list + `ToolLifeLog`, `InstrumentIssue`, `CalLabRequisition`/`CalLabVendorRating`, `SparePart`.
**Config vs guardrail:** PM rules, thresholds, min spares, tool-life policy = configurable; G-4 (no expired instrument measuring), safety-release gates = guardrails.

> **v2 rebuild status (C8 COMPLETE, 2026-09-05):** maintenance/tooling **state core** rebuilt DB-proven on `v2` — engines `src/lib/maintenance/{jobState,pm,toolLife,calibration,spares,permit}.ts` (TDD, 57 tests), adapter `src/lib/maintenance/maintenanceTx.ts` (engine-gated, audited), routes `/api/v2/maintenance/*` (jobs + actions, pm-rules + scan/auto-create, tool life actions, instrument G-4 issue/return/recal, spares/kit issue, permit-to-work with per-leg authz). Guardrail enforcement: P28 RCA+countermeasure on long breakdowns, G-4 expired/quarantined instrument refusal, mandatory replace at max regrinds/life, no silent negative spare stock, 3-leg permit approval. Real-DB smoke `npm run test:c8-8` (CI-wired) 15/15 green → **20/20 after C8-9 completion (same day)**: production tool wear wired into v2 LOG_GOOD (`productionWear.ts` + `applyProductionToolWearTx` inside shopfloor `applyJobAction`), G-4 enforced at measurement time (not just crib issue) via `inspectionGate.ts` + `createInspectionTx` + `/api/v2/quality/inspections`, and machine-FAULT → BREAKDOWN auto-scan (`breakdownScan.ts` + `/api/v2/maintenance/breakdowns/scan`, create + duplicate-suppress + cooldown). Still deferred to later cycles: RUL/predictive engine, MTBF/MTTR analytics, spare auto-reorder POs, cal scope recall. DEPTH_04 W11 note for workflow detail.
**AI:** maintenance copilot — checklist drafts from history, failure-pattern explainers, spares pre-pick, recall-scope drafts.
**Code anchors:** `/maintenance/*`, `/api/maintenance/*`, `src/lib/{calibration,capacityEngine}.ts`, `desktop/lib/watchdog.js` (server-side analog).

---

## F10. EHS, Safety & Sustainability (workspace `ehs`)

**Feature families.** Safety incidents & investigations (5-Why, `SafetyIncident`), near-miss reports, safety audits & observations, PPE inventory & issue (`PpeIssue`), permits to work (`PermitToWork`), haz-waste manifests (`HazWasteManifest`), chemicals register (`Chemical`), consents & environmental permits (`Consent`), fire extinguisher inspections, energy & environmental records (`EnergyReading`/`UtilityReading`, `EnvironmentalRecord`), trainings, visitor & vehicle logs.

**Key records:** F10 list.
**Config vs guardrail:** audit cadence, PPE rules, permit categories = configurable; incident no-delete + investigation closure evidence = guardrails.
**AI:** EHS copilot — incident-narrative drafting from witness notes, corrective-action suggestions, permit-checklist drafting, digest of expiring consents.
**Code anchors:** `/ehs`, `/system/safety`, `/api/safety*`, `/api/ppe*`, `/api/haz-waste*`, `/api/consents*`, `src/lib/riskRegister.ts` (adjacent).

---

## F11. Continuous Improvement & QMS (workspace `system`/`quality`)

**Feature families.** Idea box + upvoting + pipeline (`Idea`), kaizen reports, 5S audits (`FiveSAudit/FiveSAuditScore/FiveSItem`), lean observations + minutes saved (`LeanObservation`), improvement projects & RCA (`ImprovementProject/RcaRecord/ActionItem`), routines & SOP progress (`RoutineStep/RoutineProgress`), QMS document control (`QmsDocument`, `QmsAudit/QmsAuditFinding`), announcements.

**Key records:** F11 list.
**Config vs guardrail:** categories, scoring, cadence = configurable; audit finding closure evidence = guardrail.
**AI:** lean copilot — idea clustering/duplicate detection, kaizen write-up drafting, 5S audit report drafting, RCA hypothesis framing.
**Code anchors:** `/system/{ideas,kaizen,fives,lean}`, `/api/{ideas,lean-observations,kaizen}*`, `src/lib/sourceRecordEdit.ts` (Idea edits).

---

## F12. System, Admin, Automation & Security (workspace `system`)

**Feature families.**
- **Settings & constants** — `Setting` map; admin tabs: branding, constants (OEE thresholds, plan gates, OT limits, upload limits, PO multipliers), module activation (`activeDepartments`), currency/plant config, count tolerance, requireMillCerts.
- **Custom entities builder** — `CustomEntity/CustomField/CustomRecord` admin UI for org-defined record types.
- **Org model admin** — units, role assignments, levels, reporting lines, approval chains, terminology, delegation/acting (builds on DEPTH_02; current UI = roles/users only).
- **Users, roles & access** — user create/role grant (tree-of-trust), password policy + reveal-for-onboarding (audited), access reviews, session revocation via `sessionEpoch`, audit viewer (`AuditLog`), overrides workbench (`Override`, `kpi.override`), source-record edits (`records.edit`, reason-mandatory).
- **Automation & rules** — flows/recipes studio under `/automation` (client surface today; automation/webhook/api-token persistence = roadmap).
- **Health & diagnostics** — `/system/health`, `/api/health`, diagnostics, build monitor (`buildMonitor.ts`), program health, synthetics runner.
- **Uploads & files** — logo/branding upload (data-URI pattern, size/type gates), document file storage (DB bytes).

**Key records:** F12 list + `LoginAttempt`, `AccessReviewCycle/AccessCertification`, `ItAsset/ItTicket`, `Escalation`, `Announcement`.
**Config vs guardrail:** nearly everything here is config — except: owner indestructibility, session rotation on permission change, reason-mandatory edits, license gate, proxy fail-closed (guardrails).
**AI:** setup/configuration copilot — the day-one AI: guides admin through org modeling and workflow configuration in natural language (DEPTH_05 §6.1).
**Code anchors:** `/system/admin`, `/api/settings*`, `/api/admin/data`, `src/lib/{settings,permissions,departments,roleCatalog,audit,sourceRecordEdit,overrideEngine,health,serverHealth,desktopControl}.ts`, `src/proxy.ts`.

---

## F13. Gateway, Onboarding, Terminal Public Surface & Showroom

**Feature families.**
- **Gateway (`/`)** — branded entry; redirects by auth/onboarding state.
- **Onboarding** — first-run wizard (force-dynamic, anonymous on fresh install): company/branding, plants, sample vs empty data, admin account; single-instance seed path (desktop `seedIfEmpty`).
- **Login & password lifecycle** — local + optional Google SSO; change-password-on-first-login; locked flows (fail-closed).
- **Public surfaces** — landing/lead capture, `/track`, `/showroom` (3D demo), andon wall; kiosk APIs with LAN token gate.
- **Mobile/PWA** — installable, offline queue for floor actions, QR badges/machine tags.

**Key records:** `Setting`, `User`, `Lead` (kiosk devices are LAN-token-gated clients, not DB rows yet).
**Config vs guardrail:** branding, login methods, showroom on/off = configurable; fail-closed auth in production, kiosk token enforcement when set = guardrails.
**AI:** onboarding copilot introduces itself here — "set the app up your way" guided conversation.
**Code anchors:** `src/app/{page,onboarding,login,landing,showroom,track,terminal}.tsx`, `src/lib/{auth,permissions,onboardingSample}.ts`, `desktop/launcher.js` (seed gate).

---

## Cross-department inventory check

Every family above maps to (a) schema models, (b) route dirs under `src/app/api/`, (c) engines in `src/lib/`, (d) seats + permissions from `DEPTH_02`, (e) AI touchpoints from `DEPTH_05`, and (f) an offline/LAN posture from `DEPTH_06`. Known missing-but-specified items (from `HANDOVER.md`/`docs/ORG_GAP_ANALYSIS.md`, all tracked): credit/debit notes + returns, e-invoice IRN + GSTR-1/3B exports, petty cash, CSR matrix breadth, skill/competency matrix + SOP sign-off, gratuity provisioning, employee loans & advances, supplier portal/ASN, accident register (LTI), POSH/ICC, employee credential expiry, litigation/IP registers, tender/bid management, BG/LC register, capex CER with ROI, product recall notices, org-chart/level model (DEPTH_02 §7), approval-chain UI, acting coverage UI, customer-connect EDI formats.

---

*Next: `docs/DEPTH_05_AI_COPILOTS_LOCAL.md` — the local AI architecture and per-seat copilots.*
