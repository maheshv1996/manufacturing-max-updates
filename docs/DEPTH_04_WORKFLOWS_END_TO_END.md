# DEPTH 04 — Workflows End-to-End

**Status:** Authoritative workflow reference. Companion docs: `DEPTH_01_VISION_AND_PRINCIPLES` (§6 guardrails), `DEPTH_02_ORG_MODEL_AND_ROLES` (seats & approval chains), `DEPTH_03_FEATURES_BY_DEPARTMENT`, `DEPTH_05_AI_COPILOTS_LOCAL`.
**Reading standard:** every workflow lists — **Purpose · Actors (as seats, not fixed titles) · Trigger/inputs · State machine steps · Rules & validations · Exceptions · Data & traceability · Audit & integrity · Config vs guardrail · Offline/LAN · AI touchpoints · KPIs.** If a failure mode is not spelled out, the workflow is not done (principle 8).

Actors are written as seats (e.g., "QC Engineer (unit Quality)"); approval steps resolve through the org's approval chains (`DEPTH_02` §6). Status names match the schema enums where the flow is already built.

---

## W1. Quote-to-Cash (enquiry → cash in bank → GL)

**Purpose.** Win profitable work and convert it to cash with zero manual re-keying, protecting margin at every hand-off.

**Actors.** Sales/Sales Engineer seat (commercial unit) · Estimator (engineering) · Commercial head (approval) · Production planner (PPC) · Quality planner · Storekeeper · QC · Dispatch · Accounts/Finance.

**State machine.**
```
Lead → Opportunity
Quotation: DRAFT → SENT → (WON | LOST) → CONVERTED
Sale: SalesOrder → (WorkOrder W1 per line) → Production (W2) → FAI gate (W6)
       → QC → DispatchRecord (challan) → Invoice (W8) → Payment → GL posting (W9)
```

**Steps.**
1. Enquiry captured as Lead/Opportunity (source, customer, part, qty, target price, due date); CRM notes; win-probability.
2. Estimator builds quotation from the product's BOM + routing standard times + machine/energy rates (`estimatingEngine`, `costingEngine`) — the system computes unit cost live; margin % shown; **loss-bid safeguard** flashes below configured min margin; alternate "target price" modes.
3. Commercial head approves above org threshold (approval chain); quotation SENT with revision history; printable quote.
4. **WON** → one-click conversion creates SalesOrder + WorkOrders per line; quoted price carries through. **LOST** → reason captured (win-loss), feed for win-rate analytics.
5. Dispatch (W8 step): challan(s) against the SO; one invoice per dispatch rule; invoice posts receivables.
6. Payment received (cash/UPI/cheque/RTGS/NEFT) recorded against invoice(s); aging cleared; GL posted (W9). Reconcile with bank statement (treasury, `GstReconRun`, bank reconcile).

**Exceptions.** Partial shipment (multi-challan allowed); partial payment (INVOICE status PARTIAL until zero); customer disputes invoice → credit/debit note path (W8); quotation expired/revised; customer changes qty after WON → re-quote vs SO amendment (org config); payment mismatch → bank reconciliation flags.

**Config vs guardrail.** Margin floor, approval threshold, quote numbering, tax profile (INTRA/INTER GST) = configurable. One-invoice-per-dispatch and balanced GL posting are guardrails (G-8).

**Audit & integrity.** Every status change audited (`AUDIT`), amounts integer paise, sequence numbers via `SequenceCounter` (no count+1 race), mutations in `$transaction`.

**Offline/LAN.** All internal; customer-facing doc generation is local. Offline queue irrelevant inside a plant but quote PDFs/emails may be sent via the org's mail when connected (never required).

**AI touchpoints.** Draft quote narrative & proposal from enquiry + history; flag thin-margin quotes and suggest negotiation levers from win/loss history; draft sales-order amendments; explain margin variance vs estimate at WON; compose dispatch/invoice covering notes.

**KPIs.** Quote→win rate; quote turnaround; estimate vs actual margin (the money metric — feeds costing, see `monthMargin` logic on `/command`); days-quote-to-cash; aging buckets.

---

## W2. Plan-to-Production (WO lifecycle with readiness, gates, shift counting)

**Purpose.** Turn accepted work into good parts on time with material, certs, and quality conditions proven *before* the floor starts, and exactly-counted WIP at every shift boundary.

**Actors.** Planner (PPC seat) · Storekeeper · Setup/Operator (terminal) · Supervisor · QC/FAI engineer · Maintenance · Plant head (escalation).

**State machine.**
```
WorkOrder: PLANNED → IN_PROGRESS → COMPLETED   (ON_HOLD any time)
WO readiness: NOT_READY → READY (material ✓, certs ✓, drawing rev ✓, fixture ✓, calibration ✓, FAI ✓)
Routing: currentSeq advances per RoutingStep; hold points gate serial/lot advance
Production: LOG_GOOD / LOG_SCRAP / LOG_REWORK / DOWNTIME events mutate WIP + cost
Shift boundary: ShiftCount OUT vs IN (AGREED | DISPUTED → RESOLVED by supervisor)
```

**Steps.**
1. Planner creates WO from SO line or MRP suggestion (`mrpEngine` explodes BOM demand vs stock): qty, product/rev, routing, dates, priority, plant, project link. Numbered via sequence.
2. **Readiness check** (`readinessEngine`): BOM material in stock (or POs/GRNs in flight), required mill certs flagged, drawing revision current vs ECO effectivity, fixture status, calibration of assigned tools/instruments, FAI state for the part-rev. Dashboard chips show `Short: <material>`, hold points, cert gaps. Unready WO cannot START.
3. **Issue**: storekeeper issues material (`MaterialIssueSlip`, inventory OUT transaction with lot/batch + cert link); optional serial allocation when `trackingMode=SERIAL`.
4. **FAI gate (G-1)**: first article per part-rev requires APPROVED FAI (W6) before full production; terminal blocks job start if FAI not satisfied.
5. **Production**: operator on terminal (badge login) picks machine + WO; START_JOB advances WO to IN_PROGRESS; each piece logged Good/Scrap/Rework with defect code (scrap auto-quarantines to MRB W5); downtime logged with reason/category; tool-life and cycles decrement (`ToolLifeLog`); machine state + Andon reflect live (RUNNING/DOWN/IDLE). Idempotent actions (G-9).
6. **Hold points**: serial/lot unit stops at a hold-point routing step until `HoldPointSignoff` by authorized seat (G-2) — inspection, customer hold, engineering.
7. **Shift handover/counts**: outgoing operator enters WIP count; incoming verifies vs tolerance (`count_tolerance` setting, `/api/shift-counts`) → AGREED or DISPUTED; supervisor resolves disputes with final count + note. Shift handover log with context snapshot.
8. **Completion**: when good qty = planned (or planner closes), WO COMPLETED; job cost finalized (W9); remaining material returned; serial events closed to stock; traveler printed.

**Exceptions.** Material shortage mid-run → planner expedites PO or splits WO (ON_HOLD/partial complete); scrap exceeds threshold → supervisor + quality review before continue; machine breakdown → downtime + maintenance job (W11) + schedule re-plan; FAI rejection → WO blocked until ECO/re-inspection; disputed shift count → supervisor resolution (see ShiftCount flow); operator ends shift mid-WO → count handoff (step 7) not optional.

**Config vs guardrail.** Tolerance, priority scheme, downtime categories, rework thresholds, serial vs batch default, report cadence = configurable. FAI-before-full-production, hold-point signoffs, idempotent logs, no-delete logs = guardrails.

**Audit & integrity.** Every good/scrap/downtime/handoff event audited with actor+time; operator actions carry `X-Client-ID` idempotency keys (`IdempotencyKey`, pruned daily); sequence counters for WO/challan/invoice numbers; adjustment edits via `sourceRecordEdit` require reason.

**Offline/LAN.** The terminal is the critical offline surface: actions queue in `localStorage` (`offlineSync.ts`) and replay with idempotency keys when the tablet reconnects to the LAN server. Kiosk LAN token gate optional (REALWORLD_PILOT §1). Andon TV polls `/api/andon`.

**AI touchpoints.** Operator seat: "next action" prompts (start the job, log scrap w/ suggested defect, call maintenance), multilingual voice (EN/TE/HI), explain why WO is not ready (readiness reasons in plain language). Supervisor seat: digest of at-risk WOs, suggested re-sequencing; shift handoff mismatch explainer. (DEPTH_05 seat specs.)

**KPIs.** OEE (Availability×Performance×Quality), schedule adherence, WIP turns, scrap %, FTT, shift-count dispute rate, cost vs estimate per WO.

> **C2 implementation status (2026-09-05, branch `v2`):** the state core for steps 4–8 is implemented as typed engines + adapter — WO status machine (gates: readiness/fixture, written-reason HOLD, authorized short closure), event ledger (counters open-log only, downtime open/close, machine states, no-delete), hold-point advance rule, shift-count tolerance/dispute rules, and a readiness engine (typed gap list; server fixture+FAI gates active, material/cert/rev/calibration snapshot joins with C3/C4/C5). Scrap auto-quarantine row creation landed (MRB flow is C3). See `docs/plans/2026-09-05-cycle2-shopfloor-mes.md`.

---

> **C5 implementation status (2026-09-05, branch `v2`):** steps 2–6 state core implemented as typed engines + adapter + routes — PO approval ladder (APPROVED → PENDING_MANAGER → PENDING_OWNER → APPROVED; REJECT terminal with reason), receipt gate composing the double-receipt guard (`ALREADY_RECEIVED`), the W3 cert gate (`CERT_REQUIRED` when `requireMillCerts` is on and certs don't cover the qty; certs upload with the GRN, one IN row per cert), and over-delivery tolerance; GRN posts stock atomically inside one `$transaction` with idempotent replay (same clientId skips). Three-way match with invoices lands in C6. See `docs/plans/2026-09-05-cycle5-supply-chain.md`.

## W3. Buy-to-Stock (requisition → PO → GRN → QC → inventory with mill certs)

**Purpose.** Buy the right material, prove it with certificates, and move it into usable stock — with no un-certed stock, no double receipts, no silent price drift.

**Actors.** Requester (any seat w/ supply request rights) · Buyer (purchase unit) · Dept head/Finance (approval tiers) · Supplier · Storekeeper (receipt) · QC (incoming) · Inventory/Finance.

**State machine.**
```
PurchaseRequisition: OPEN → (ORDERED | CANCELLED)
PO: ORDERED → PARTIAL → RECEIVED    (CANCELLED)
GRN per shipment → GRNLine → inventory IN (lot/bin/cert) → QC result (PASS | REJECT)
Supplier scorecard updated on every receipt (OTIF, quality, price)
```

**Steps.**
1. Requisition auto-generated from MRP shortages or manual (tools, spares, services); approval per chain if above tier.
2. Buyer creates PO from approved requisitions (or directly from shortages screen); terms, tax (INTRA/INTER GST), delivery date; `validate.ts` schema checks; number via sequence. Rate contracts & comparative statements (multiple quotes) surface at creation.
3. PO ORDERED → supplier; follow-ups logged (`PoFollowUpLog`).
4. Supplier delivers: storekeeper receipts against PO line (partial allowed → status PARTIAL; full → RECEIVED). GRN posts inventory IN with quantity, lot/batch, bin, and **material cert attachment required when `requireMillCerts` setting is on** (cert type COC/MTC/TC; validity tracked). **Atomic `updateMany` stock guards** prevent double-receipt races; `$transaction` across GRN + inventory + PO.
5. Incoming QC (FQC/IPQC/AQL plan) samples; PASS → stock usable; REJECT → material held + NCR/return path; supplier notified.
6. Supplier payment later via W8-style payable flow (SupplierInvoice); GL posts at GRN (inventory) and at invoice/payment (payables).

**Exceptions.** Over-delivery (org tolerance); damage in transit (photo + claim note, NCR); cert missing → receipt blocked for material (G-4 adjacent: no cert = not usable for aero); supplier cannot deliver on time → expedite/escalate, scorecard hit; price drift vs PO (invoice variance flag); rejected GRN → return challan + credit note path; dispute over received qty.

**Config vs guardrail.** Approval tiers, requireMillCerts on/off per module/plant, bin scheme, AQL plan, tolerance %, PO/GRN numbering = configurable. No-delete receipts, atomic stock updates, idempotent GRN, cert-before-use for tracked material = guardrails.

**Audit & integrity.** Full `InventoryTransaction` ledger (IN/OUT/ADJUST each with reason + actor), `adjustmentHistory` on corrections, `IdempotencyKey` on GRN receipt, sequence numbers.

**Offline/LAN.** Storekeeper terminal tolerant of LAN blips (queue + idempotent replay); everything else LAN-native.

**AI touchpoints.** Draft requisitions from MRP output; summarize supplier risk from scorecards + past NCRs at PO creation; QC draft disposition text; answer "what certs are missing for material X?" from cert registry; flag duplicate/overspend POs.

**KPIs.** PO cycle time; OTIF; stock accuracy; % certified stock; inactive inventory; price variance; supplier quality rate.

---

> **C5 implementation status (2026-09-05, branch `v2`):** challan machine implemented — accredited-scope dispatch gate (`VENDOR_NOT_ACCREDITED` when the contract requires accreditation), receive-back cert gate (`CERT_MISSING` for special-process certs), QC signoff PASS → QC_PASSED / FAIL → QC_FAILED with NCR routing flag (the NCR document itself is created by the W5 quality flow). See `docs/plans/2026-09-05-cycle5-supply-chain.md`.

## W4. Subcontract & Special Process Loop (outsourcing with DC control)

**Purpose.** Send work (parts/heat treatment/NDT/surface finish) to accredited vendors without losing the traceability thread or evidence.

**Actors.** Planner · Buyer · Storekeeper (outward/inward) · QC (inward sign-off) · Special-process vendor coordinator · Finance.

**State machine.** `SubcontractChallan` (DC numbered) OUT → vendor → inward receipt → QC signoff (accredited scope check against `SpecialProcessVendor`) → PASS returns to stock/next routing step | FAIL → NCR → vendor CAPA.

**Steps.** Create subcontract need from WO routing step flagged external (accredited vendor per process type NADCAP/etc.) → DC with part/lot/rev + required certs → outward inventory movement (with lot trace) → inward receipt → QC sign-off against vendor's accredited scope & cert validity (`SpecialProcessVendor.status`) → accepted lots re-enter genealogy with vendor step recorded (`SerialEvent` keeps the full 6-stage thread: mill heat → machining → subcontract → FAI → packaging → dispatch) → vendor invoice/payment.

**Exceptions.** Vendor loses cert/scope (auto-block for that process until renewed); partial returns; customer restricts specific vendors (approved-vendor list per customer = CSR); rework at vendor; DC/receipt mismatch.

**Config vs guardrail.** Vendor list, process types, DC numbering, payment terms = configurable. Accredited-scope gating (can't send a NADCAP-required process to an unaccredited vendor when the customer contract demands accreditation) = guardrail.

**AI touchpoints.** Draft DC and pick vendor by scorecard/accreditation; QC sign-off suggestion; explain genealogy path of a serial (customer question answered from `SerialEvent`).

**KPIs.** Vendor OTIF & first-pass; subcontract cost vs in-house; cycle time out-and-back; open DCs aging.

---

## W5. Quality Loops — NCR/MRB → 8D → SCAR and Customer Complaints (SLA)

**Purpose.** Every non-conformance (internal scrap, supplier defect, customer complaint) becomes a tracked disposition and — where severity demands — a closed-loop 8D with evidence, under SLA deadlines.

**Actors.** Originator (operator/QC/store) · MRB seat (disposition authority — org/customer-defined) · Quality engineer (8D owner) · Supplier quality (SCAR) · Customer-facing quality · Plant head (escalation).

**State machines.**
```
NCR: OPEN → UNDER_REVIEW → DISPOSITIONED → CLOSED
      disposition: USE_AS_IS | REWORK | SCRAP | RETURN_TO_SUPPLIER (authority: MRB/customer per contract)
8D:  D1_TEAM → D2_PROBLEM → D3_CONTAINMENT → D4_ROOT_CAUSE → D5_CORRECTIVE
     → D6_PREVENTIVE → D7_VERIFY → D8_CLOSURE   (cannot reach D8 without D4–D7 evidence — G-3)
Complaint: OPEN → ACKNOWLEDGED (≤24h, stamps ackAt) → INVESTIGATING → CAPA → CLOSED
     (10-day 8D deadline; breached flags surface on exec strips)
Scrap: ScrapQuarantine PENDING → disposition (ReworkOrder/WriteOff/MRB)
```

**Steps.**
1. Any defect auto-creates NCR (scrap on terminal with defect code quarantines and can auto-open NCR per org config) or complaint (customer call/email logged with severity; SLA clock starts at receipt).
2. MRB reviews; disposition + authority + justification; USE_AS_IS may require customer concession when contract says so (guardrail); quarantine stock released/reworked/scrapped accordingly; rework spawns ReworkOrder back into W2; write-off flows to fixed-asset/scrap GL.
3. Severity/8D rules route to 8D; D1 team charter; D3 containment actions land as dated ActionItems with owners (e.g., sort inventory, containment at customer); D4 root cause (5-Why/fishbone/Ishikawa); D5/D6 corrective & preventive with CAPA evidence; D7 verification on the line; D8 closure reviewed by quality manager.
4. Supplier-caused → SCAR to supplier, supplier 8D tracked, scorecard + PO block until resolved if org configured.
5. Complaint SLA auto-aging: ACK overdue (24h), 8D overdue (10d) appear as exec red/orange strips + digest; escalation chains fire.

**Exceptions.** Customer rejects disposition (re-open); root cause lands outside plant (vendor) → SCAR; containment ineffective (re-verify D7 fails → loop back to D4); complaint duplicated across batches → one 8D linked to multiple NCRs; dispute on responsibility (internal vs supplier).

**Config vs guardrail.** Who is MRB authority per disposition class, whether customer concession needed, SLA hours, severity matrix, defect codes = org-configurable. Evidence-before-8D-close, disposition authority recorded, quarantine integrity = guardrails.

**Audit & integrity.** Full timeline per NCR/8D/complaint; every transition audited with actor+note; deadlines computed from ackAt/createdAt; complaint SLA logic in `src/lib/complaintSla.ts`; risk flags feed MRM agenda + digest.

**Offline/LAN.** Shop-floor NCR creation works over LAN kiosk; supplier communication is file-based (never blocked by offline).

**AI touchpoints.** The 8D drafting copilot is the flagship quality AI surface: from the complaint/NCR timeline it drafts D1 team suggestion, D3 containment plan candidates, D4 root-cause hypotheses (not verdicts) for the engineer to confirm, and a verification plan — each editable and signed by the owner. MRB seat gets a disposition briefing (history of the part, similar past dispositions, customer contract notes).

**KPIs.** NCR aging by severity; 8D cycle time; complaint SLA breach rate; scrap cost; disposition rework recovery; supplier CAPA closure rate; repeat-defect rate (same defect code within N days).

> **C3 implementation status (2026-09-05, branch `v2`):** the W5 state core is implemented as typed engines + adapter + routes — NCR machine (disposition authority incl. USE_AS_IS customer concession), 8D machine with the G-3 evidence gate (D4–D7 before D8_CLOSURE; quality-manager review before CLOSED), complaint SLA clocks (24h ack / 10d 8D), scrap-quarantine → NCR creation. See `docs/plans/2026-09-05-cycle3-quality-compliance.md`.

---

## W6. FAI & Data Package (AS9102 evidence)

**Purpose.** Prove the part meets the drawing/rev before production and hand the customer a frozen, complete dossier.

**Actors.** FAI engineer · Metrology (CMM/gauges, calibrated instruments only — G-4) · Engineering (drawing/rev) · Quality manager (approval) · Customer rep (when contracted).

**State machine.**
```
FaiReport: IN_PROGRESS → SUBMITTED → APPROVED | REJECTED
  FaiCharacteristic per balloon: PASS | FAIL (deviation → justification or NCR)
DataPackage: DRAFT (assembles FAI + certs + serial events + process records) → RELEASED (frozen — G-6)
```

**Steps.** WO/product rev triggers FAI on first article (or per contract event) → balloon drawing/form 1-2-3 built from routing/QC parameters → measurements recorded (instrument must be in calibration — G-4) → deviations flagged (USE_AS_IS needs approval/contract concession) → SUBMITTED → approval by required seats → APPROVED feeds W2's FAI gate. Data package assembled (FAI + material certs + serial genealogy + process logs + customer-required docs) → RELEASED frozen; later changes = new revision with audit.

**Exceptions.** Measurement out-of-spec but functionally OK → deviation request; instrument due calibration mid-run → hold; drawing rev changes mid-FAI → ECO (W7) then re-run affected characteristics; customer requests extra characteristics → CSR matrix extension.

**Config vs guardrail.** Required characteristics set, approval seats, release contents = configurable. No APPROVED FAI = no full production (G-1); released package frozen (G-6); calibrated-instrument-only measurement (G-4) = guardrails.

**AI touchpoints.** FAI prep copilot drafts Form 1-2-3 grouping, flags characteristics at risk from past deviations, explains deviations in plain language, assembles draft data package contents and lists missing evidence.

**KPIs.** FAI first-pass; FAI cycle time; data package completeness %; deviation rate.

> **C3 implementation status (2026-09-05, branch `v2`):** FAI machine implemented (IN_PROGRESS→SUBMITTED→APPROVED|REJECTED; unjustified deviations block SUBMIT) + data-package release gate with G-6 frozen/newRevision semantics; APPROVED FAI feeds the C2 shopfloor G-1 gate. See `docs/plans/2026-09-05-cycle3-quality-compliance.md`.

---

## W7. Change Control — ECO/ECN (drawings & BOM law)

**Purpose.** Make engineering changes deliberate, reviewed, effectivity-controlled, and impossible to ignore on the floor (DEPTH_01: "revisions become law").

**Actors.** Originator (engineering seat) · Engineering lead · Quality manager · Plant head/design authority · (Customer when contract requires) · Planner (floor adoption).

**State machine.**
```
Eco: DRAFT → APPROVED | REJECTED → IMPLEMENTED
  effectivity: by DATE | by SERIAL | by BOM revision (EcoEffectivityType)
  affects: BOM lines | Routing | Drawing/Document | both (EcoEntityType)
```

**Steps.** Engineering proposes change on BOM/routing/drawing (visual diff of Rev A vs Rev B surfaced) → approval chain (engineering lead → quality → plant head per org) → APPROVED with effectivity recorded → IMPLEMENTED updates live BOM/routing/document rev with audit + archived superseded revision → floor consequence: readiness engine uses current revision only; WOs on obsolete rev flagged; traveler/drawing references updated; supplier/docs synced.

**Exceptions.** Change during an active FAI → re-run affected characteristics; serial-effectivity split (units up to #N old rev, from #N+1 new); customer veto on a contractual change → REJECTED/re-issue; doc pack (DataPackage) contains superseded rev → release blocked until ECO adoption confirmed.

**Config vs guardrail.** Approval seats, effectivity default, categories = configurable. APPROVED+effectivity before IMPLEMENTED (G-5), obsolete-rev floor blocking = guardrails.

> **C4 implementation status (2026-09-05, branch `v2`):** ECO machine (DRAFT→APPROVED|REJECTED→IMPLEMENTED with G-5 effectivity validation: ISO date / `N | N+ | A..B` serial ranges), revision-law engine (`isObsoleteRev`/`woAllowedRev`/`revisionGap` feeding C2-3's `DRAWING_REV`), document revision issuing (forward-only, superseded rows ARCHIVED) — engines + adapter + `/api/v2/change/*` routes, smoke-tested on a real Postgres. See `docs/plans/2026-09-05-cycle4-change-control.md`.

**AI touchpoints.** Draft ECO impact summary (which WOs, BOMs, customers, suppliers touched); propose adoption plan; draft customer notification.

**KPIs.** ECO cycle time; ECO-induced scrap/obsolete stock; floor use of obsolete rev (should be 0).

---

## W8. Dispatch → Invoice → Payment (GST India) and Credit/Debit Notes

**Purpose.** Ship only what is invoiced and invoice only what is shipped — with legally sound GST documents, one dispatch = one invoice, and cash collected.

**Actors.** Dispatch clerk · Commercial seat · Accounts · Customer · Bank (reconciliation).

**State machine.**
```
DispatchRecord (challan, DC-YYYY-XXXX) → Invoice (one per dispatch) → UNPAID → PARTIAL → PAID
GST: INTRA → CGST+SGST | INTER → IGST (TaxType per company settings)
Payments: Payment/PaymentRecord/PaymentMethod → treasury → GL (W9)
Corrections: CreditNote / DebitNote (reverse/adjust) — audited, never delete (G-7)
```

**Steps.** Completed WOs/goods staged → challan printed (delivery docs) → dispatch recorded with lots/serials (keeps genealogy: packaging EAN scan optional `PackagingScanLog`) → invoice generated with Indian number-to-words total, tax auto-computed from GSTIN state pair → receivables created (integer paise) → payment captured against invoice(s) (partial allowed) → aging cleared → GL posted; GST return data exportable (GSTR-1/3B orientation) & reconciliation runs (`GstReconRun`).

**Exceptions.** Returns → credit note + inward movement; pricing dispute → debit/credit note; payment in foreign currency for exim customers (`EximShipment`, Incoterms); short payment → auto-allocate oldest first (org config); bounced cheque → reversal + bank recon flag; e-invoice IRN when mandated (future build, DEPTH_03 finance list).

**Config vs guardrail.** Tax profiles, invoice numbering, payment allocation rule, credit terms, aging buckets = configurable. One-invoice-per-dispatch, no-delete of financial documents (reversal only), integer paise, balanced GL posting = guardrails.

**AI touchpoints.** Draft invoice covering notes; payment allocation suggestions; explain an aging outlier; draft credit-note reason + customer mail; bank-recon anomaly explainer.

**KPIs.** DSO, aging buckets (0-30/31-60/61-90/90+), credit-note rate, invoicing accuracy, cash collection.

---

## W9. Finance Close — Job Costing, GL Integrity, Month-End, Treasury

**Purpose.** The books always balance, every operational document lands in the GL with provenance, and month-end is an audit, not archaeology.

**Actors.** Finance/Accounts seats · Plant head · Costing (engineering overlap) · Treasury.

**State machine (continuous, not just month-end).**
```
Document events (invoice/payment/PO/GRN/payroll/expense) → journal postings (debits=credits, paise)
Daily: 02:30 desktop sweep POSTs /api/finance/gl-integrity (control-token gate) → GlIntegrityRun
Month-end: fiscal-period close (FiscalPeriod) → integrity scan → variances surfaced → adjustments posted with reason
Job costing: WO events roll live cost (material + labor + overhead + energy + tooling) → margin vs estimate (W1)
```

**Steps.** Every money event writes balanced journal lines (`JournalLine` debit/credit paise) through one posting engine (`glPosting/glEngine/glBackfill`) with **provenance** (which document, which user, which idempotency key) → daily integrity sweep scans for unbalanced entries and unposted documents, recording each run (`GlIntegrityRun`) surfaced on the finance hub + `/finance/gl-backfill` workbench → backfill replays missing documents idempotently → treasury transactions & bank statements reconcile (`BankStatementEntry`, bank-reconcile module) → fiscal period close freezes a period (postings to closed periods blocked/guarded) → fixed-asset depreciation & payroll accruals post per schedule → risk register reviews stay on cadence (RK entries, L×I scores, review due dates) → compliance digest for exec.

**Exceptions.** Unbalanced entry (sweep flags, never silent); document edited after posting → edit-with-reason re-posts adjustment; period already closed → guarded reopening with audit; bank statement gap; duplicate idempotency keys; risk review overdue (auto-flag).

**Config vs guardrail.** Account mapping, fiscal calendar, backfill window, review cadence = configurable. Balanced double-entry, integer paise, provenance on every posting, no silent corrections = guardrails (G-8 + DEPTH_01 principle 2).

**AI touchpoints.** Finance copilot explains anomalies ("why did receivables jump?"), drafts adjustment narrative, reconciles discrepancies by suggestion, composes month-end commentary from integrity results.

**KPIs.** Integrity-scan result (0 issues target), posting latency to GL, month-end close days, reconciliation gaps, aging.

---

## W10. People Flows — Assignment & Role Grant, Leave/Overtime, Payroll Run

**Purpose.** Right people, right seats, right time; statutory-clean time & pay; payroll that posts to the GL with zero transcription.

**Actors.** HR seat · Reporting manager · Employee/Operator · Plant head (approvals) · Finance (payroll).

**State machines.**
```
Role grant: Request → manager → HR (users.manage) → RoleAssignment active → sessionEpoch bump (sessions rotated!)
Leave: PENDING → APPROVED | REJECTED (manager); running balance decremented on approval
Overtime: OvertimeRequest (from floor, W2) → approval → statutory limit flags (>50h/mo)
Attendance: clock in/out (badge) → AttendanceLog → payroll input
Payroll: PayrollRun → Payslip (salary structure + attendance + OT + statutory) → posts to GL → payslip archive
```

**Steps.** Hire/onboarding → Employee row + User + initial role (change-password-on-first-login) → assignments per org model → access review cadence (`AccessReviewCycle`/`AccessCertification`) → daily clocking via terminal/attendance devices; leave with balance; OT from shift needs; monthly payroll run computes pay from structure + attendance + OT with statutory (PF/ESI) contributions, generates payslips, posts accruals/liability to GL; exit flow (notice → handover → FnF → access revocation → audit).

**Exceptions.** Absence without leave; OT cap breach (flag, needs plant-head approval); payroll corrections (adjustment slip, audited); statutory rate change; late attendance device sync; offboarding with open approvals (re-route per W-cadence).

**Config vs guardrail.** Shift windows, leave policy, OT multiplier, salary components, payroll cut-off = configurable. Statutory contributions & limit flags, session rotation on grant/revoke, payroll posting integrity = guardrails.

**AI touchpoints.** HR copilot drafts offer/role-grant summaries; answers policy questions; payroll exception explainer; digest of expiring certifications/visas (people credential expiry in org backlog).

**KPIs.** Attendance accuracy; OT compliance; payroll cycle; role-grant latency; access-review completion.

---

## W11. Maintenance — PM, Breakdown, Spares, Calibration & Tool Life

**Purpose.** Keep machines running with planned work and never let an uncalibrated gauge or a worn tool touch a part.

**Actors.** Maintenance planner · Technician · Operator (defect reports) · Store (spares) · Metrology/Cal lab · Procurement (repair PO).

**State machines.**
```
PM: PMRule (by run-hours/cycles/calendar) → MaintenanceJob scheduled → issued → completed w/ findings
Breakdown: machine DOWN (operator/telemetry) → MaintenanceJob BREAKDOWN (priority) → diagnosis → repair → release
Spares: MaintenanceJob → spare issue → SparePart stock OUT → reorder at min
Calibration: CalibratedTool → due → CalLabRequisition → vendor/cal lab → status renewed | rejected (decommission)
Tool life: Tool/CalibratedTool cycle decrements on LOG_GOOD → wear % → warn → mandatory replace
```

**Steps.** Rules auto-create PM jobs from run hours; breakdowns create jobs from machine DOWN events (Andon); technician executes with findings + parts + labor (job costing feeds W9); release back to production; calibration recalls instruments at due date (G-4: expired = no inspection use), vendor ratings (`CalLabVendorRating`); tool-life warnings reach the operator screen before failure; all costs roll to the machine/WO costing.

**Exceptions.** PM overdue (auto-flag); breakdown while no spare (expedite PO + substitute machine schedule); calibration fails → instrument quarantined + re-inspection of parts measured since last cal (scope recall); tool breaks mid-run → scrap + root-cause to maintenance.

**Config vs guardrail.** PM rules, thresholds, spare min levels, cal due windows = configurable. No expired instrument in measurement (G-4), no released machine with open safety defect = guardrails.

**AI touchpoints.** Maintenance copilot drafts PM checklists from machine history; explains repeated failure patterns (vibration/RUL models where data exists); suggests likely spares for a job from past jobs; cal-lab draft of recall scope.

**KPIs.** MTBF/MTTR, PM adherence, breakdown frequency, calibration overdue count, tooling cost per part.

---

> **C5 implementation status (2026-09-05, branch `v2`):** cycle-count core implemented — session/lines, physical count vs book with tolerance from the `count_tolerance` setting, variance flagged COUNTED when out of tolerance, approved adjustment (authority = `supply.approve` + written reason) posts an ADJUST transaction and updates stock (no silent negatives). Write-off GL and valuation remain later cycles. See `docs/plans/2026-09-05-cycle5-supply-chain.md`.

## W12. Inventory Integrity — Cycle Counts, Movements, Write-Offs, Physical Stock

**Purpose.** The system count and the floor count agree, and every difference is explained.

**Actors.** Storekeeper · Cycle count team · Supervisor (approval) · Finance (write-off value).

**State machine.**
```
CycleCountSession (per bin/SKU class ABC) → CycleCountLine counts → variance → recount | ADJUST w/ reason → InventoryTransaction ADJUST
MovementLog + MaterialIssueSlip + GRN = every physical move; WriteOffRequest → approval → WriteOffLine (value to GL)
```

**Steps.** ABC schedule generates count sessions → counter enters physical counts on tablet → variance vs system → investigate (movement log audit trail) → supervisor approves ADJUST with reason (audit) → ledger updated → valuation reports reconcile to GL inventory account.

**Exceptions.** Count interrupted; variance > threshold needs second count; missing lot/cert in bin (blocked movement until resolved); write-off of quarantined scrap → MRB first (W5).

**Config vs guardrail.** ABC classes, frequency, thresholds, tolerance = configurable. Movement only via transactions (no free-form stock edits), ADJUST with reason + approval, no delete = guardrails.

**AI touchpoints.** Predict likely variance causes from movement history; draft adjustment rationale; flag bins whose movement history contradicts counts.

**KPIs.** Count accuracy; adjustment rate; stock-out; inactive stock value.

---

## Cross-cutting: what every workflow inherits

- **Identity & auth** — proxy fail-closed; session rotation on permission change; seat resolution per request (DEPTH_02 §3).
- **Audit** — `AuditLog` rows on every state transition + `adjustmentHistory` on record edits + idempotency keys + sequence counters; nothing reachable only by "whoever remembers".
- **Approvals** — org-defined chains resolved against the live org chart with escalation + acting coverage (DEPTH_02 §5–6).
- **AI** — assist-first copilots per seat read the same workflow state, draft/suggest/explain, and route any action through the same authorization+approval+audit path as a human (DEPTH_05).
- **Offline** — every floor-facing path (terminal, kiosk, andon) has queue + idempotent replay; server-side schedules (backup 20:00, prune 02:15, GL sweep 02:30) are LAN-local (desktop launcher).

---

*Next: `docs/DEPTH_03_FEATURES_BY_DEPARTMENT.md` — the full feature surface per module against this workflow spine.*
