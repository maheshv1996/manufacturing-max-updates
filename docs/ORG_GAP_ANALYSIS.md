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