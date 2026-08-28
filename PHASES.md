# Development Phases & Milestones

## Definition of Done (Per Phase)
- DB Schema updated and migrations applied (or schema synced).
- All requested API routes created and tested.
- Frontend components connected to live API.
- TypeScript compiler returns zero errors (`npx tsc --noEmit`).
- Production build succeeds (`npm run build`).
- Relevant documentation (`MEMORY.md`, etc.) updated.

## Phase History

### Season 1 & Reality Packs [DONE]
- Initial MES/ERP core foundation.
- Reality packs for machine states and production logs.

### Loops A-D [DONE]
- Core CRM, Quotations, and basic Inventory management.

### UX Rebuild & Design Overhaul [DONE]
- Complete styling migration to standard tokens.
- Dark mode, elevation tiers, and 150ms transition enforcements.

### RBAC Tree Implementation [DONE]
- Role-based Access Control matrix applied across the dashboard.
- Hierarchical permission checks built into API routes.

### Aero Compliance Pack (1-7) [DONE]
- 1. Batch vs. Serial Tracking [DONE]
- 2. AS9102 First Article Inspection (FAI) [DONE]
- 3. NCR / Material Review Board (MRB) [DONE]
- 4. Material Certificates (COC, Mill Certs, Test Reports) [DONE]
- 5. Hold Points & Quality Sign-offs [DONE]
- 6. Data Packages & Dossier Generation [DONE]
- 7. ECO/ECN Configuration Management [DONE] *(Terminal effectivity gating: DRAWING/ROUTING/BOM on shop floor, incl. SERIAL no-serial conservative default)*
- 8. Calibration & Special-Process Registry (Nadcap) [DONE] *(CalibratedTool/SpecialProcessVendor models, Metrology admin tab, EXPIRED-tool inspection hard-block, EXPIRED-vendor dispatch block, dashboard widget, Calibration Register + Approved Vendors reports)*

### Tool Crib & Instrument Management [DONE]
- InstrumentMasterRegister → CalibratedTool with location/lifecycle/interval.
- Issue/Return logs (InstrumentIssue), custody + location tracking, auto-quarantine cage for EXPIRED instruments, cert archive (Bytes upload/download), procurement → active → retired lifecycle.
- Organization hub (`/departments`) maps all 13 enterprise departments to live implementations.

### R&D / Prototype Mode [DONE]
- R&D Lab (`/rnd`) with prototype iterations, test campaigns & records.
- Prototype WOs (`projectType: RND`) bypass ECO effectivity gating on the Operator Terminal (drawings/BOM/routing always show latest).

### Corporate Services & Compliance Wave [DONE]
- Statutory PF/ESI register (`/people/statutory`) + printable register.
- EHS hub (`/system/ehs`): occupational health checks, environmental compliance, fire drills.
- EXIM shipments (`/commercial/exim`) + printable register (auditor-grade).
- Investor Relations (`/system/investors`), Budget & Treasury (`/commercial/treasury`).
- Utilities (`/system/utilities`), Spares (`/supply/spares`), Contracts (`/projects/contracts`).
- IT Infrastructure & Backups (`/system/infrastructure`): assets + backup job log.
- Architecture: generic `/api/register/[entity]` CRUD + `DynamicRegister` component (config-driven, audit-logged).
- `/departments` org tree: every one of the 13 departments now maps to a LIVE implementation.

### Executive Visibility Wave [DONE]
- Corporate Compliance red-flag strip on `/command`: live flags from environmental records, failed backups, below-min spares, and expiring contracts (critical red / warning amber), each linking to its module.
- Print/PDF export added to every corporate register via `DynamicRegister` (print-optimized tables, controls hidden on print).
- PF/ESI Payment Challan generator (`/reports/pf-esi-challan`): monthly aggregate PF + ESI challan with amount-in-words (Indian numbering), signature blocks, and per-employee annexure; month picker + reports-hub card.

### Enterprise Coverage Wave [DONE]
- Recruitment & Onboarding (`/people/recruitment`): job requisitions, candidate pipeline (SCREENING→INTERVIEW→OFFER→HIRED/REJECTED stage moves), interview scheduling with feedback, onboarding checklists per hire.
- QMS Internal Audits (`/system/qms`): ISO 9001 / AS9100 audit schedule (auto audit numbers), clause-based findings with MINOR/MAJOR/CRITICAL severity, corrective actions linked to NCRs, complete-audit result flow.
- Marketing & Branding (`/commercial/marketing`): campaigns with budget-vs-spent tracking, lead pipeline (incl. leads captured from the public /landing form), and a landing-page content editor persisted to Setting `landingContent` — the public page renders it live.
- Every department branch on `/departments` now links to a real, LIVE implementation; Finance deep-dive documented in `docs/FINANCE_DEPARTMENT.md`.

### Finance Deepening Wave [DONE]
- Payroll & Salary (`/people/payroll`): salary structures (CTC breakup: basic/HRA/allowances/PF%/PT), monthly payslip generation (gross, PF = min(basic, ₹15,000) × %, PT, net), printable payslips report `/reports/payslips` (per-employee payslip cards + payroll totals).
- Bank reconciliation (Treasury → Reconcile tab): CSV statement upload with same-day/same-amount auto-match against treasury transactions, manual matching dropdown, unmatch/delete, summary chips.
- Challan → treasury auto-posting: `ChallanPostButton` on `/reports/pf-esi-challan` creates an OUTFLOW Statutory TreasuryTransaction (deduped by challan reference).
- Daily Compliance Digest (`/reports/compliance-digest`): shared `src/lib/complianceDigest.ts` engine (also reused by `/command`), printable one-page briefing of all critical/warning flags + calibration/vendor/quality counts, `ComplianceDigestLog` dispatch history, cron-ready POST `/api/compliance/digest/send` (owner recipients; email gateway hook documented), plus an in-app bell notification for owners.

### Email & Automation Wave [DONE]
- Real email gateway: `src/lib/email.ts` sends via the Resend REST API (`fetch`, zero new deps) when `RESEND_API_KEY` is set; `EMAIL_FROM` + `NEXT_PUBLIC_APP_URL` envs supported. Digest dispatch now actually emails owners (status `EMAILED`/`LOGGED` on `ComplianceDigestLog`); challan page gained an **Email Challan** button (`POST /api/treasury/email-challan`).
- Vercel Cron: `vercel.json` schedules `/api/compliance/digest/send` at 07:00 daily; the route accepts `Authorization: Bearer $CRON_SECRET` for unauthenticated cron invocations.
- Budget variance flags: `getComplianceFlags()` now also flags budget overruns (spent > allocated → critical) and ≥80% usage (warning) from `budgetLines` — flows into the `/command` strip, digest report and API; treasury Budget tab shows a live overrun/near-limit banner (`BudgetVarianceBanner`).
- CSV exports: `/api/audit/export` (filtered audit log, CSV button in Admin → Audit tab) and `/api/payroll/export` (Tally-friendly payslips CSV, download button on `/reports/payslips`).

### Productivity & Quality Wave [DONE]
- Notifications Center (`/notifications`): the computed notification feed (HR leaves, low stock, maintenance, complaints, compliance) with per-user read/acknowledge persistence (`NotificationRead`), Mark-All-Read, and a View-All link in the topbar bell dropdown.
- Supplier Scorecards (`/supply/scorecards`): quarterly OTD / quality PPM / cost variance / responsiveness with weighted overall score (35/35/15/15) and A–D grade computed server-side; printable register `/reports/supplier-scorecards` with averages.
- Time Study (`/ops/time-study`): SAM per operation with measured time, and a live actual column computed from shop-floor production logs (avg min/unit per product, last 90 days) with variance % badges.
- Internal Audit Register report (`/reports/audit-register`): printable ISO 9001 / AS9100 audit schedule with findings, open and critical counts.

### Escalation & Intelligence Wave [DONE]
- Escalation Register (`/system/escalations`): Escalation model + action-based API. GET returns escalation board plus auto-detected **candidates** — open QMS audit findings, budget overruns (spent > allocated), and open NCRs — deduped by `sourceType:sourceId` (escalated but unresolved items never re-appear). Escalate / Acknowledge / Resolve / Delete + custom escalations; open escalations surface in the notifications bell.
- Annual Quality Calendar (`/reports/quality-calendar`): year-at-a-glance month grid with colored cells for internal audits, calibration due (teal) / overdue (red), PM jobs, PF/ESI challan months and GST return months; legend + year picker + print.
- Procurement Intelligence (`/supply/intelligence`): supplier scorecard trends across periods (grade chips + trend arrows), supplier spend analysis (committed vs paid bars), and below-min spares cross-referenced against open POs by supplier (green = covered, red = no open PO).
- Work Order Standard-Time card (`/ops/work-orders/[id]`): per-product SAM rollup vs actual run time from that WO's production logs — efficiency badge (green/amber/red), actual-per-unit and variance stats, per-operation breakdown table.

---

## CURRENT PHASE
**Escalation & Intelligence wave complete — verifying & hardening**
Ensuring that serial-controlled Work Orders adhere strictly to ECO effectivity gates when rendering Drawings and BOMs on the shop floor.

## NEXT PHASES
- **Calibration-Driven Hold Points:** Auto-block routing at a step when the inspection tool assigned to that step is out of calibration (extends the manual hold-point system).
