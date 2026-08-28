# Manufacturing Max — Release Notes

## v1.0.0 — Enterprise MES & Lean Six Sigma Platform

> The digital nervous system of your factory. One login, thirteen departments,
> zero paper. Built for ISO 9001 / AS9100 aerospace and defence manufacturers.

---

## 1. Department Gateway & Experience

- **Public gateway** — a cinematic landing experience with all **13 departments**
  as Apple-grade tiles: Executive, Engineering & R&D, Production, Quality,
  Instrumentation / Metrology, Supply Chain, Sales & Marketing, Finance & Accounts,
  HR, EHS, Maintenance, Projects / Programs, IT & Systems.
- **Drill-down navigation** — tap a department to reveal its sub-functions (e.g.
  Quality → IQC, IPQC, FQC, NDT, NCR/MRB, 8D, PPAP, Gage R&R, Complaints, QMS),
  with breadcrumb back.
- **Contextual login** — sign in from any sub-function; the server routes you to
  the area you have permission for, or your home hub. Permission checks are
  server-side on every redirect — never client-only.
- **Post-login shell** — a spring-animated 13-department accordion sidebar
  (collapsible to an icon rail), Cmd+K command palette, notification bell,
  plant switcher, and avatar menu. Route transitions respect
  `prefers-reduced-motion` and never animate the operator terminal or prints.

## 2. Production & Operations

- **Operator Terminal** — touch-first, trilingual (EN / తెలుగు / हिंदी), big
  buttons, works on a 339px mobile viewport with zero horizontal scroll.
  Good / scrap / rework entry, downtime reasons, clock in/out, machine
  selection, shift handover counts, safety reports and maintenance requests —
  **all queued offline** with `clientId` dedupe and auto-drain on reconnect.
- **Work Orders** — status pipeline (PLANNED → IN_PROGRESS → COMPLETED),
  readiness engine (material shortages surfaced as red "Short:" pills),
  live production progress bars, customer dispatch dates, copyable public
  tracking links.
- **Capacity & Scheduling** — overloaded-machine-day warnings, dispatch
  planning, time-and-method study, andon, scrap & rework registers, SPC.
- **OEE engine** — availability / performance / quality with configurable
  thresholds (Good / Warning / Critical) and previous-period deltas.

## 3. Quality (QA / QC) — Nadcap-ready

- **FAI (First Article Inspection)**, **NCR / MRB**, **8D / CAPA**, **PPAP**,
  **Gage R&R (MSA)**, **Customer Complaints**, **QMS & Audits**.
- **Metrology & Special-Process Registry** — calibrated tools (gauges, torque
  wrenches, CMM, micrometers) and special-process vendors (heat treat, plating,
  NDT, welding, anodize) with live status bars.
- **Nadcap enforcement** — logging an inspection on an aerospace / serial work
  order *requires* selecting the calibrated tool; an **expired tool hard-blocks
  the inspection** with a red "CALIBRATION EXPIRED — Inspection Invalid" modal
  and a `CALIBRATION_BLOCKED` audit trail. Expired special-process vendors
  cannot be dispatched.
- **Compliance dashboard widget** — expired / expiring tools and vendor certs
  counted live.

## 4. Instrumentation / Metrology

Instrument master register, issue/return logs, location & custody tracking,
calibration scheduling with certificate archive, out-of-calibration quarantine
cage, and instrument procurement & retirement — plus **printable calibration
register** and **approved special-process vendor list** (the exact documents an
auditor asks for on day one).

## 5. Supply Chain & Materials

Purchasing / procurement with supplier scorecards (on-time %, lead time, spend),
goods receipt (GRN), stores & warehousing, inventory control with low-stock
alerts, supplier SQA & intelligence, reconciliation, and EXIM shipments.

## 6. Sales, Finance, HR, EHS, Maintenance, Projects

- **Sales & Marketing** — quotations & estimation (auto-BOM pricing), order
  booking, marketing campaigns, export sales, EXIM.
- **Finance & Accounts** — receivables aging (0–30 / 31–60 / 61–90 / 90+),
  payables from PO vs payment ledgers, job costing per work order, monthly
  financial performance (revenue / cost / profit / margin) on the dashboard,
  energy cost per machine-hour, statutory PF / ESI.
- **HR** — recruitment & onboarding, training & skills, time office
  (attendance / shifts / leave), leaderboards, statutory compliance.
- **EHS** — safety incident investigation, 5S audits, occupational health
  (fitness records), environmental compliance, kaizen & idea boards.
- **Maintenance & Utilities** — breakdown and preventive/predictive
  maintenance (PM rules), utility meter readings, energy dashboards.
- **Projects / Programs** — program planning, contracts, customer coordination.

## 7. Executive Dashboard & Reports

- **Command center (`/command`)** — live OEE, downtime by category, champion
  leaderboard, compliance red-flags, metrology status, financial summary,
  receivables & payables, low-stock alerts, energy, pending ECOs, and NCR /
  complaint / MRB counts — **all fetched in parallel** (dashboard TTFB
  ~0.5s with a full seed database).
- **Reports hub** — morning pack, calibration register, approved vendors,
  profitability, receivables, sales register, stock register, PO register,
  compliance digest — every report is print-clean.

## 8. Offline Edition & Deployment

- **Air-gap ready** — self-hosted fonts, zero external runtime assets, service
  worker app-shell caching (the UI never white-screens), server health hook
  with an amber "Server unreachable — retrying" banner.
- **Desktop launcher** (Windows) — license gate (HMAC-signed keys, 14-day
  grace), bundled database, watchdog auto-restart ≤5s, tray with Backup Now /
  Restore / Export-to-pendrive / LAN QR, daily 8 PM backups with keep-last-30
  rotation, and start-with-Windows for power-cut resilience.
- **Updates** — GitHub Releases channel with sha256-verified installers;
  pendrive "Update from File" for air-gapped sites; data directory preserved
  across updates.
- **System Health page** — uptime, DB size, disk free, last backup, LAN QR,
  and a **stale-build watchdog** that flags a server serving an outdated
  manifest before it can silently break the UI.

## 9. Security & Administration

- RBAC with ADMIN / SUPERVISOR / OPERATOR hierarchy, hierarchical permission
  sets, temp passwords with "must change on next login", audit log with
  password-reveal events, Google SSO (optional), and server-side permission
  gating on every route.
- Admin console covering machines, users, products, BOM, routings, shifts,
  lines, downtime reasons, defect codes, energy, certifications, documents &
  SOPs, plants, metrology & vendors, and system constants.

---

*Verified: `tsc --noEmit` clean · `npm run build` green · 31/31 desktop unit
tests · all sidebar routes 200 · prints render cleanly · operator terminal
mobile-clean.*
