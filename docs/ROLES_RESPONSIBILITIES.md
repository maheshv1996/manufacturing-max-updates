# Roles & Responsibilities - the complete organisation

How every real-world role works in MfgMax: responsibilities, the system
surface they use, the permission bundle they need, grade ladder where
applicable, and the capability gaps that role still hits (cross-referenced
to `docs/ORG_GAP_ANALYSIS.md`).

Conventions:
- **Grade ladder** applies to engineering-style roles: TRAINEE -> JUNIOR ->
  SENIOR -> LEAD. Grades gate what the role can author/approve (e.g. a
  JUNIOR drafts an SOP, a SENIOR approves it, a LEAD/Head releases it).
  The grade ladder itself is backlog item T2-1/T3-3 (not yet built).
- **Permissions** are the existing keys in `src/lib/permissions.ts`
  (16 domains x view/edit + special keys). Functional role bundles that
  bundle them are backlog item T2-1 (not yet seeded).
- **Missing** refers to `docs/ORG_GAP_ANALYSIS.md` tiers (T2 = tier-2,
  T3 = tier-3, T4 = tier-4).

---

## 1. Executive

### Owner / Director (MD)
- Strategy, funding, statutory accountability, board governance.
- System: board pack, investor updates, MRM close-out, access review,
  quality objectives, risk register (CRITICAL), escalations, dashboard.
- Permissions: ADMIN (all) + `exec.view/edit` + `audit.view`.
- Missing: board resolutions + related-party registers (T3-8), litigation
  register (T4-5), whistleblower channel (T2-9).

### Plant Head / GM
- Runs the plant: P&L, production vs plan, cost, quality, people.
- System: `/command` dashboard, S&OP, finite capacity, CoQ, budget burn,
  payroll approval chain, risk register, MRM, escalations.
- Permissions: `exec.view/edit` + all domain view + approve keys.
- Missing: capex requests with ROI (T4-9), org chart + RACI (T2-1),
  accident/LTI board (T4-2).

---

## 2. Production / Operations

### Production Manager
- Shift execution, plan adherence, output, manpower, OEE ownership.
- System: WOs, PPC priority board, finite capacity, S&OP decisions
  (overtime/extra shift/outsource), hourly andon, shift handover,
  gate pass approval, job costing review.
- Permissions: `ops.edit` + `ops.approve` + view of supply/quality.
- Missing: daily production report rollup (partially in andon).

### Shift Supervisor (MANAGER level)
- Runs the shift: machine allocation, first-off checks, breaks, disputes.
- System: shift counts reconcile (AGREED/DISPUTED), downtime approvals,
  scrap/rework approvals, overrides, operator attendance, roster.
- Permissions: SUPERVISOR bundle + `ops.approve` + `records.edit`.

### Machine Operator (grade ladder: TRAINEE/JUNIOR/SENIOR)
- TRAINEE: supervised runs, no autonomous setup.
- JUNIOR: standard jobs, logs production/downtime on the terminal.
- SENIOR: setups, first-off, quality checks, mentor, may release
  handover.
- System: `/terminal` (production/downtime/safety logs, clock-in,
  My Queue skill-gated, IPQC checklists, fixture + stale-rev pills,
  MY ROSTER strip).
- Permissions: OPERATOR bundle + `terminal.use`.
- Missing: machine-side SOP display + sign-off per operation (T3-3),
  competency matrix with recert expiry (T3-3).

### PPC / Planner
- Planning: order book vs capacity, material plan, WO release.
- System: `/ops/ppc`, `/ops/schedule`, `/api/mrp`, S&OP, buyer board
  escalations, material issue slips.
- Permissions: `ops.view` + `ops.edit` (planning subset).

### Methods / IE Engineer (grade ladder)
- Time studies, standard times, lean observations, work instructions.
- System: `/ops/time-study`, `/ops/ie-observations`, estimation sheet,
  routing steps admin.
- Permissions: `engineering.edit` + `ops.view`.
- Missing: SOP-per-operation authoring (T3-3), MOC for process changes
  (T2-7).

---

## 3. Quality

### Quality Head / Manager
- QMS ownership, MRM, objectives, audits, customer scorecards, escapes.
- System: `/quality/mrm`, `/quality/objectives`, `/system/qms` audits,
  supplier scorecards, 8D register, PPAP register, QMS doc control.
- Permissions: `quality.edit` + `quality.approve` + `audit.view`.
- Missing: supplier audits (T2-3), CSAT/VOC (T2-4).

### Quality Engineer (grade ladder)
- JUNIOR: inspection planning, FAI execution support, NCR drafting.
- SENIOR: FAI review, 8D leadership, control plan updates, GRR studies.
- System: FAI, NCR/MRB, 8D/CAPA, PPAP, control plans, GRR, calibration
  holds, IQC AQL, FQC checklist.
- Permissions: `quality.edit` (senior) / `quality.view` + inspect actions
  (junior).

### Inspector (IQC / FQC / IPQC)
- Incoming inspection per AQL, in-process checks, final dispatch
  checklist, gage use.
- System: GRN inspection, FQC checklist, IPQC checklists on terminal,
  hold-point sign-offs.
- Permissions: `quality.view` + `terminal.use` + inspect actions.

### Internal Auditor
- QMS + process audits, findings, CAPA follow-up, MRM input.
- System: `/system/qms`, `/reports/audit-register`, access review.
- Permissions: `audit.view` + domain views; findings write.
- Missing: audit scheduling engine (register is manual).

---

## 4. Supply Chain

### SCM Head
- Sourcing strategy, supplier performance, rate contracts, risk (supply).
- System: supplier scorecards, PO approval chain, comparative statement,
  rate contracts, buyer board, risk register (SUPPLY category).
- Permissions: `supply.edit` + `supply.approve`.
- Missing: supplier audits (T2-3), supplier self-service portal/ASN
  (T4-1), BG/LC register (T4-8).

### Buyer (JUNIOR/SENIOR)
- JUNIOR: requisition-to-PO, follow-ups, expediting.
- SENIOR: negotiation, comparative awards (within limits), rate
  contracts, PO approvals above thresholds.
- System: `/supply/buyer-board`, PRs, POs, PO follow-up log, quotations
  from suppliers, freight bookings.
- Permissions: `supply.view` + PO create/follow-up; award actions
  gated by threshold + level.
- Missing: distinct BUYER bundle vs store (T2-1).

### Storekeeper
- Receipt, binning, issue, cycle count, dead stock.
- System: GRN receipt, bin map, material issue slips, cycle count
  sessions, dead-stock write-off proposals, spares.
- Permissions: `supply.edit` (stores subset).
- Missing: STOREKEEPER bundle separation (T2-1).

### Freight / EXIM Coordinator
- Dispatch booking, freight scoring, EXIM milestones, gate pass.
- System: `/supply/freight`, `/commercial/exim`, `/supply/gate-pass`,
  special-process vendor checks.
- Permissions: `supply.view/edit` + `commercial.view`.
- Missing: ASN from suppliers (T4-1).

---

## 5. Maintenance

### Maintenance Head
- MTBF/MTTR, RCA discipline, PM compliance, budget (spares).
- System: reliability dashboard, breakdown RCA gate, PM schedules,
  budget burn card, risk register (OPERATIONAL).
- Permissions: `maintenance.edit` + `maintenance.approve`.
- Missing: MOC for machine changes (T2-7).

### Maintenance Engineer (JUNIOR/SENIOR)
- JUNIOR: PM execution, job cards, downtime logging, spares request.
- SENIOR: breakdown RCA + countermeasure, job close (manager-gated),
  PM rule design, tool-life review.
- System: job board, PM schedule, tool room, spare parts, permits
  (permit-to-work gates), reliability.
- Permissions: `maintenance.edit` (senior) / `maintenance.view` +
  job actions (junior).
- Missing: competency/recert for specialised trades (T3-3).

### Tool-Room Keeper
- Tool/fixture issue, regrind, scrap decisions, instrument issue.
- System: tool life logs, fixture register, instrument issue (metrology),
  tool crib quarantine.
- Permissions: `maintenance.view/edit` + `metrology.view`.

---

## 6. Commercial / Sales

### Sales Manager
- Pipeline, quotation approval (discount >5%), price revisions,
  follow-up cadence, collections oversight.
- System: enquiry funnel, quotations, discount approval chain,
  price revisions, follow-ups, customer exposure, collections aging.
- Permissions: `commercial.edit` + `commercial.approve`.
- Missing: sales quota & commission (T3-12), CSAT (T2-4).

### Sales Executive (JUNIOR/SENIOR)
- JUNIOR: lead capture, quote preparation, follow-ups.
- SENIOR: negotiation within limits, win/loss analysis, key accounts.
- System: leads, marketing campaigns, quotations, follow-up board,
  win/loss reasons, tender tracking (future).
- Permissions: `commercial.view` + quote actions.
- Missing: tender/bid management (T4-7).

### Marketing Executive
- Campaigns, landing content, lead gen, branding.
- System: `/commercial/marketing`, lead register, landing editor,
  brand settings.
- Permissions: `commercial.edit` + `brand.edit`.

### Collections Officer
- Aging buckets, collector assignments, dunning L1->L2->L3, follow-ups.
- System: `/finance/collections`, dunning letters, collection
  accounts, exposure.
- Permissions: `commercial.view` + `finance.view` + collections actions.

---

## 7. Finance

### CFO / Finance Head
- Books, statutory compliance, funding, treasury, budget, risk
  (FINANCIAL), board pack.
- System: GL reports, fiscal periods, bank recon, treasury, budget +
  cost centers, vouchers (check), GST recon, Tally export, risk
  register, board pack, collections.
- Permissions: `finance.edit` + `finance.approve` + `exec.view`.
- Missing: capex requests (T4-9), BG/LC register (T4-8), gratuity
  provisioning (T3-4), credit/debit notes (T3-1), TDS tracker (T2-5).

### Accountant (JUNIOR/SENIOR)
- JUNIOR: voucher entry, invoice booking, bank entries, reconciles.
- SENIOR: maker-checker, fixed asset schedules, GST recon, Tally
  export, month-end close.
- System: vouchers (maker), journals, invoices, GRN matching, fixed
  assets, bank reconcile, GST recon, Tally export.
- Permissions: `finance.view` + entry actions; check actions
  manager-gated.
- Missing: ACCOUNTANT bundle vs finance manager (T2-1).

### Payroll Officer
- Salary structures, payslips, statutory (PF/ESI/PT), challans,
  run approvals (APPROVED -> LOCKED), overrides.
- System: `/people/payroll`, statutory register, PF/ESI challan
  generator, payroll export, time office, OT.
- Permissions: `people.edit` (payroll subset) + `finance.view`.
- Missing: TDS quarterly/annual returns (T2-5), gratuity (T3-4),
  employee loans & advances (T3-5).

### Treasury Officer
- Inflow/outflow, bank balance, challan posting, petty cash.
- System: treasury, bank reconcile, email challan post, GL auto-post
  repair queue, backfill workbench.
- Permissions: `finance.edit` (treasury subset).
- Missing: petty cash register (T3-6), cheque register (T3-10).

---

## 8. People / HR

### HR Head
- Policy, compliance (CLRA, statutory), grievances, disciplinary,
  training, risk (HR).
- System: CLRA register, grievances, disciplinary, training
  effectiveness, statutory, compliance digest, risk register.
- Permissions: `people.edit` + `people.approve`.
- Missing: POSH/ICC cases (T4-3), succession planning (T2-6),
  policy acknowledgements (T2-8), whistleblower (T2-9).

### HR Executive (JUNIOR/SENIOR)
- JUNIOR: recruitment admin, onboarding tasks, attendance, leaves.
- SENIOR: interviews, appraisals review, disciplinary support,
  exit process.
- System: recruitment, onboarding, attendance, leaves, roster,
  appraisals, grievances, training.
- Permissions: `people.edit` (subset).
- Missing: offboarding management (T2-2), credential/document expiry
  tracker (T4-4), skill matrix (T3-3).

### Training Coordinator
- Programs, attendance, effectiveness scores, compliance training.
- System: training programs, training attendance, appraisals input.
- Permissions: `people.view/edit` (training subset).
- Missing: competency matrix with recert expiry (T3-3).

---

## 9. EHS

### EHS Head
- Statutory consents, permits, incidents, near-miss quota, risk
  (SAFETY/ENVIRONMENT), safety metrics.
- System: consents, permits-to-work, haz-waste, extinguishers, health
  checks, environmental records, fire drills, near-miss quota, safety
  observations, risk register, compliance digest.
- Permissions: `ehs.edit` + `ehs.approve`.
- Missing: accident/incident register with LTI (T4-2).

### EHS Officer
- Inspections, safety observations, near-miss logging, permit
  sign-offs, contractor induction.
- System: `/ehs`, permits (approval slots), observations, extinguisher
  monthly inspections, health records.
- Permissions: `ehs.edit` (subset).
- Missing: contractor EHS induction tracking (small).

---

## 10. Engineering / R&D

### Engineering Head
- Drawing control, ECO/ECN, R&D campaigns, fixture strategy, methods.
- System: transmittals, ECO effectivity, R&D test campaigns, PPAP
  support, MRM.
- Permissions: `engineering.edit` + `engineering.approve`.
- Missing: MOC (T2-7), IP register (T4-6).

### Design / Methods Engineer (JUNIOR/SENIOR)
- JUNIOR: drawing updates, fixture design, time study support.
- SENIOR: ECO/ECN authorship, FAI review, control plans, estimate
  approval.
- System: transmittals, ECO implement, fixtures, estimation,
  routing steps, SOPs (future).
- Permissions: `engineering.edit` (senior) / view + draft (junior).
- Missing: SOP-per-operation with grade-gated authoring (T3-3).

---

## 11. IT

### IT Admin / System Admin
- Users, roles, sessions, backups, updates, devices, infrastructure,
  access reviews, kiosk gate, licenses.
- System: `/system/admin`, `/system/health`, update channel, access
  review, restore drills, infrastructure assets, backup jobs,
  attendance device registry, risk register (IT).
- Permissions: `system.edit` + `users.manage` + `audit.view`.
- Missing: password policy enforcement (T3-9), software license
  register (T4-11).

### IT Support (JUNIOR/SENIOR)
- Tickets, SLAs, device help.
- System: IT tickets (M31), infrastructure, backup jobs.
- Permissions: `system.view` + ticket actions.

---

## 12. Legal / Compliance (the legal.* space is unused today)

### Legal Counsel / Compliance Officer
- Contracts, litigation, statutory registers, whistleblower, RPT.
- System: contracts register (exists), risk register (COMPLIANCE),
  compliance digest, MRM.
- Permissions: `legal.view/edit` - first consumer needed.
- Missing: litigation register (T4-5), board resolutions + RPT
  (T3-8), policy acknowledgements (T2-8), whistleblower channel
  (T2-9).

---

## 13. Projects / Program

### Project Manager
- Milestones, program health, contract delivery, escalation to exec.
- System: `/projects`, program health, milestones, contracts,
  escalations, board pack.
- Permissions: `projects.edit` + `projects.approve`.
- Missing: contract expiry/milestone alerts into digest (T2-11).

---

## 14. Metrology

### Metrology Head
- Calibration programme, gage R&R governance, instrument control.
- System: calibration register (hard-blocks), GRR, instrument issue,
  metrology admin, special-process vendors.
- Permissions: `metrology.edit` + `metrology.approve`.
- Missing: MSA stability/linearity studies (extension of GRR).

### Calibration Technician
- Due schedules, calibration records, quarantine actions.
- System: calibration register, instrument issue, GRR data entry.
- Permissions: `metrology.view/edit` (subset).

---

## 15. Risk / Governance

### Risk Champion / Owner (the risk.* keys exist but are unused)
- Risk register upkeep, review cadence, mitigation tracking, MRM
  risk agenda.
- System: `/system/risk-register`, compliance digest (Risk Register
  category), MRM agenda, escalation board.
- Permissions: `risk.view` (all) / `risk.edit` (champion) - wire into
  the risk-register route gates (backlog T2-1).
- Missing: risk heat-map + trend (nice-to-have UI), RACI linkage
  (T2-1).

---

## 16. Sustainability / Brand (domains exist)

- **Sustainability officer:** energy/utility readings, environmental
  records, haz-waste, sustainability.view/edit.
- **Brand owner:** branding settings, marketing, brand.view/edit.

---

## What to build to make this real (in order)

1. **T2-1 Role bundles + grade ladder + org chart/RACI** - seed the
   bundles in this document as reusable presets; add grades
   (TRAINEE/JUNIOR/SENIOR/LEAD) so "junior drafts, senior approves"
   becomes an engine-wide pattern; org chart gives reporting lines.
2. **T3-3 SOP-per-operation with grade-gated authoring + terminal
   sign-off** - the example that started this document, now concrete:
   QmsDocument gains operationId/machineId/requiredGrade/author/reviewer/
   approver; terminal lists applicable SOPs and records sign-off.
3. Then the statutory trio: T3-1 credit/debit notes, T4-2 accident
   register + LTI, T4-3 POSH/ICC.
4. Then the commercial pair: T2-3 supplier audits, T4-1 ASN.