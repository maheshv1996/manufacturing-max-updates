# Organisation Completeness — Gap Analysis (2026-09-04)

A canonical manufacturing-enterprise checklist mapped to what MfgMax already ships
(P0–P30 + M1–M32 + aero/quality/desktop waves, verified in code: routes, pages,
models). The point is honest coverage — what a complete organisation runs, and
what is genuinely missing.

## Strategy & Governance
| Need | Status |
| --- | --- |
| Management review (ISO 9.3) w/ auto agenda | ✅ `/quality/mrm` + MRM_ACTION escalation |
| Quality objectives w/ live computation | ✅ `/quality/objectives` |
| Board pack / investor updates | ✅ `/api/board-pack`, `/system/investors` |
| Internal + QMS audits | ✅ `/reports/audit-register`, `/system/qms` |
| Escalation register (auto-candidates, dedup) | ✅ `/system/escalations` |
| Access reviews + restore drills | ✅ `/system/access-review` |
| **Enterprise risk register (L×I matrix, owner, mitigation, review cadence)** | ❌ **missing — built this wave** |
| Business continuity plan | ◐ restore drills only |

## Commercial
CRM leads/marketing ✅ · quotations + enquiry funnel ✅ · price revisions ✅ ·
discount approval chain ✅ · follow-up cadence ✅ · customer exposure/limits ✅ ·
collections aging + dunning L1–L3 ✅ · GST sales register ✅ · contracts register ✅

## Supply Chain
PR/PO + approval chain + comparative + rate contracts ✅ · buyer board ✅ ·
GRN + 3-way match ✅ · freight ✅ · EXIM ✅ · bin map + dead stock ✅ ·
cycle count w/ finance approval ✅ · material issue slips ✅ · gate pass ✅ ·
supplier scorecards ✅ · procurement intelligence ✅

## Production
WOs + PPC priority ✅ · finite capacity ✅ · S&OP-lite (overtime/extra-shift/outsource) ✅ ·
tool-room life ✅ · IE/lean observations ✅ · hourly andon ✅ · OEE/SPC ✅ ·
rework/scrap ✅ · shift handover + roster + minimum-staffing guard ✅ ·
time study ✅ · estimation sheet ✅

## Quality
IQC AQL ✅ · FQC dispatch gate ✅ · NCR/MRB ✅ · FAI ✅ · 8D/CAPA ✅ ·
PPAP + control plans + PSW ✅ · gage R&R ✅ · calibration hard-gates ✅ ·
material certs ✅ · serialization ✅ · hold points + data packages ✅ ·
ECO/ECN w/ effectivity ✅ · complaints SLA ✅ · QMS doc control ✅ · metrology ✅

## Maintenance & Utilities
PM schedules + breakdown RCA gate + MTBF/MTTR ✅ · permit-to-work gates ✅ ·
spares + tool crib ✅ · utility readings ✅ · infrastructure assets + backups ✅

## People
Recruitment/onboarding ✅ · attendance devices webhook ✅ · leaves w/ roster guard ✅ ·
time office flags ✅ · OT ✅ · payroll + approval chain + export ✅ ·
performance appraisals (MES-scored) ✅ · training effectiveness ✅ ·
grievances + disciplinary ✅ · CLRA contractors ✅ · PF/ESI statutory ✅

## EHS
Health/env/fire-drill records ✅ · permits-to-work ✅ · near-miss quota ✅ ·
consent renewals ✅ · haz-waste manifests ✅ · extinguisher map ✅ · safety observations ✅

## Finance
Double-entry GL + fixed-point paise ✅ · journals + reversals ✅ · trial balance /
P&L / balance sheet ✅ · fiscal periods ✅ · voucher maker-checker ✅ ·
GST recon vs 2B ✅ · fixed assets + depreciation ✅ · treasury + bank recon ✅ ·
budget + cost centers ✅ · payroll accounting ✅ · Tally export ✅ ·
GL backfill + integrity sweeps ✅ (this wave)

## IT / Security
Login rate-limit + session rotation ✅ · RBAC + access reviews ✅ ·
desktop license gate ✅ · embedded Postgres + backup/restore drills ✅ ·
update channel + checksums ✅ · offline-first architecture ✅

## Verdict
The suite is close to a complete org already. The genuinely missing high-value
capability was **risk management**: no place to own operational/strategic risks
(likelihood × impact, mitigation, quarterly review) and no way for the
compliance digest / MRM agenda (which already aggregate every other flag) to
surface them. Built this wave:

- `RiskRegister` model + `/api/risk-register` (create/update/review/close)
- `/system/risk-register` page — L×I matrix, levels, owners, review due-dates
- compliance digest category `Risk Register` + `risk-review-due` bell → flows
  into the MRM agenda automatically via the existing digest engine
- shared `src/lib/riskRegister.ts` (scoring + review cadence) mirrored by tests

## Tier-2 - still missing for a real-world org (prioritised)

Everything below maps onto existing machinery (digest, bell, MRM agenda,
register engine, RBAC) - nothing needs a new platform. Order = frequency x
value in a real plant.

1. **Org chart + RACI / reporting lines.** A real org runs on a defined
   structure: departments -> heads -> team, with RACI for key processes.
   MfgMax has departments, levels (MANAGER/WORKER) and 3 seeded roles, but
   no org chart, no reporting lines, no ownership matrix. Build: OrgChart
   nodes + RACI register linked to processes/risks.
2. **Exit / offboarding management.** Onboarding exists; leaving does not.
   Real orgs run: resignation -> notice -> handover checklist -> full & final
   settlement -> asset recovery -> access revocation -> exit interview.
   Build: OffboardingCase lifecycle + FnF computation + access auto-revoke.
3. **Supplier audits.** Supplier scorecards (hard metrics) exist; a real
   org also audits suppliers on a schedule (process/quality/CSR checks).
   Build: SupplierAudit (due-date cadence, findings, CAPA linkage) -> digest.
4. **Customer satisfaction (CSAT) / voice of customer.** Scorecards cover
   PPM/OTD only. Real orgs run periodic CSAT surveys + complaint VOC tags.
5. **TDS compliance tracker.** PF/ESI challan generator exists; TDS
   (quarterly + annual returns, deductee reconciliation) does not.
6. **Succession planning / key-man dependency.** Risk register now covers
   dependency risks; the HR answer is a succession map per critical role.
7. **Management of Change (MOC).** ECO/ECN covers engineering changes only.
   Real orgs gate process/machine/organisation changes with MOC approval.
8. **Policy acknowledgement tracking.** QMS doc control has the documents;
   real orgs record signed acknowledgements per employee per policy.
9. **Whistleblower / anonymous ethics channel.** Grievances are named.
   Governance-grade orgs add a protected anonymous channel + audit trail.
10. **Visitor / gate management.** Outbound gate passes exist; inbound
    visitor logs, vehicle entries and badges are a security gap.
11. **Contract expiry + milestone alerts.** Contracts register exists;
    auto-expiry alerting into the digest does not (register is manual).

## Roles & responsibilities - what the system has vs a real org

**Today:** 16 workspace domains x (view/edit) + special keys
(`users.manage`, `terminal.use`, `reports.print`, `records.edit`,
`kpi.override`, `audit.view`, plus per-department `.approve` keys) in
`src/lib/permissions.ts`; three seeded roles (ADMIN, SUPERVISOR, OPERATOR);
two levels (MANAGER | WORKER). Domain wildcards (`ops.*`) and explicit key
assignment work, and PO/discount/approval chains gate by threshold + level.

| Real-world role | MfgMax today | Gap / recommendation |
| --- | --- | --- |
| Owner / Director | ADMIN + exec.* | OK |
| Plant Head / GM | ADMIN-lite (exec.view + all view) | No preset - hand-rolled |
| Dept Head (Prod/QC/SCM/Maint/HR/Fin/IT/EHS/Eng) | SUPERVISOR + own domain edit | No preset bundles; hand-rolled per user |
| Shift supervisor | SUPERVISOR (MANAGER level) | OK |
| Operator / technician | OPERATOR (WORKER level) | OK |
| Buyer | supply.view + PO create | shares supply.edit with store; needs PO-only bundle |
| Storekeeper | supply.view/edit | same key as buyer - no separation |
| Accountant | finance.view | no preset; audit-view limited |
| Finance manager | finance.edit + maker-checker | OK (thresholds) |
| HR executive | people.view/edit | no preset |
| EHS officer | ehs.view/edit | no preset |
| IT admin | system.edit | OK |
| Internal auditor | audit.view + domain views | exists as key only |
| Risk champion / owner | risk.view/edit EXISTS in the key space but is seeded/used nowhere | wire risk.* into gates + role bundles |
| Quality engineer | quality.view/edit | no preset |
| Maintenance engineer | maintenance.view/edit | no preset |

**Recommendations (zero schema change):**
1. Seed ~10 functional role bundles reusing existing keys (PLANT_HEAD,
   DEPT_HEAD, BUYER, STOREKEEPER, ACCOUNTANT, HR_EXEC, EHS_OFFICER, IT_ADMIN,
   AUDITOR, RISK_OWNER) with the ADMIN/SUPERVISOR/OPERATOR pattern.
2. Wire `risk.view`/`risk.edit` into the risk-register route gates.
3. Add an OrgChart + RACI module (tier-2 item 1) so roles hang off real
   reporting lines instead of flat permission bundles.

## Verdict (updated)

Wave 1 (risk management) is built and live. The honest tier-2 backlog above
is the rest of "a complete real-world organisation": the highest-value next
builds are (1) org chart + RACI with seeded functional role bundles,
(2) exit/offboarding management, (3) supplier audits. Each plugs into the
existing digest/bell/MRM machinery the same way risk management did.

## Tier-3 - verified against the schema (grep-confirmed absent, 2026-09-04)

Candidates that looked missing but ALREADY EXIST: PPE issue register
(`PpeIssue`, PPE-YYYY-NNN), inbound visitor log (`VisitorLog` - badge, host,
check-in/out), fleet register (`Vehicle` - RC/insurance/fitness/permit
expiries). Everything below returned 0 model matches in schema.prisma:

1. **Credit / debit notes + sales & purchase returns** - the returns process
   is a real finance-commercial flow (returns -> stock IN/OUT -> GST
   adjustment -> customer/supplier balance) and nothing models it.
2. **CSR matrix (customer-specific requirements)** - aerospace/defence
   reality (AS9100 cl.4.3.2): per-customer requirements mapped to process
   evidence, contract flow-down sign-off.
3. **Skill / competency matrix + SOP acknowledgements** - training
   effectiveness tracks programs; a matrix of required vs achieved
   competency per role (with expiry, e.g. welder recert) and machine-side
   SOP sign-off on the terminal is a real audit ask.
4. **Gratuity provisioning** - PF/ESI/PT exist in payslips; the Gratuity
   Act liability (provision + balance-sheet accrual) is unmodeled.
5. **Employee loans & advances** - salary advances / vehicle loans with
   recovery schedules against payslips.
6. **Petty cash register** - small-cash transactions between treasury
   entries, with replenishment.
7. **GST e-invoice (IRN) + GSTR-1/3B returns** - 2B reconciliation exists;
   IRN generation and return-filing exports do not.
8. **Board resolutions + related-party transaction registers** - Companies
   Act statutory registers, linked to the board pack.
9. **Password policy enforcement** - login hardening exists; expiry /
   complexity / history policy is not enforced.
10. **Cheque / payment-instrument register** - instrument issue, stop,
    clearance tracking alongside bank reconciliation.
11. **Insurance claims lifecycle** - insurance register exists; claims
    (intimation -> surveyor -> settlement) do not.
12. **Sales quota & commission** - enquiry funnel tracks pipeline; per-sales-
    person targets and commission accrual are unmodeled.

## Tier-4 - verified against the schema (grep-confirmed absent, 2026-09-04)

Checked-but-exist: `Announcement` (notice board / internal comms), haz-waste
manifests (waste disposal), dead-stock write-offs (scrap), NCR/SPC defect
codes (defect tracking). The real misses:

1. **Supplier self-service portal / ASN** - POs are one-way today. Real orgs
   let suppliers acknowledge POs, send advance shipping notices and delivery
   schedules. Medium-big lift; the cheapest useful slice is ASN + PO ack.
2. **Accident / incident register with LTI** - statutory (Factories Act
   notice) plus lost-time-injury / frequency metrics for the EHS board.
3. **POSH / ICC case register** - Internal Complaints Committee cases,
   statutory in India; separate from grievances (which are discipline-side).
4. **Employee credential / document expiry tracker** - licences, trade
   certs, visas, medicals per employee, with expiry alerts (skill matrix
   covers competency; this covers documents).
5. **Litigation register** - legal cases / notices / summons with deadlines
   and outcomes. The `legal.*` permission space exists but has nothing.
6. **IP register** - patents, trademarks, designs, trade secrets with
   renewal dates - natural for an R&D-heavy shop.
7. **Tender / bid management** - government / GEM tenders: pipeline, bid
   deadlines, win/loss with reasons (reuses the winLoss taxonomy).
8. **Bank guarantee / letter-of-credit register** - instrument issuance,
   validity, invocation - import/export reality beside EXIM.
9. **Capex request (CER)** - justification + ROI + staged approval before a
   PO; fixed-asset register exists, the decision workflow does not.
10. **Product recall / customer notification** - containment, suspect-part
    tracing, customer advisory notices (complements serialization).
11. **Software license register** - minor IT housekeeping (infrastructure
    assets exist; license ownership/expiry does not).

Platform note: a true customer AND supplier self-service portal is the one
multi-month item on the horizon; the slices above (ASN, recall notices,
quote-status portal) are the incremental path to it.