# Manufacturing Max — Complete Application & Technical Feature Specification

This document provides an exhaustive, line-by-line technical and functional specification of **Manufacturing Max** — an Enterprise Manufacturing Execution System (MES), Job Costing, Raw Material Inventory, Bill of Materials (BOM), Purchasing, Revision-Controlled Drawings & SOPs, Preventive Maintenance & Tool Life, Batch Traceability, Overtime & Compliance, and Lean Six Sigma Platform. 

It reflects the complete current state of the application, encompassing all modular workflows and the premium SaaS-grade role-based command center UX.

---

## 📋 Executive Overview & Technology Stack

- **Architecture**: Full-stack Next.js (App Router, React Server Components, Client Components), TypeScript, Vanilla CSS design system, Lucide React icons.
- **Database**: PostgreSQL (Neon Serverless PostgreSQL with `@prisma/adapter-pg` pooling), Prisma ORM v7.9.1.
- **Authentication & Security**: HTTP-only session cookies (`app_session`), bcrypt password hashing, Google OAuth SSO integration (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
- **Security Framework**: Hierarchical Role-Based Access Control (RBAC) with granular permission keys and "Tree of Trust" delegation.
- **File Storage**: In-database binary document storage (`Document.fileData` Bytes) served via serverless streaming route (`/api/docs/[id]/file`), fully compliant with read-only serverless filesystems (e.g. Vercel).
- **Reporting & Print**: Native CSS `@media print` print-optimized layouts across official plant reports, delivery challans, GST tax invoices, and job travelers.
- **Offline & Scale**: PWA installable, kiosk modes, QR-code scanning, Offline action queue for poor connectivity, and Multi-Plant hierarchy support.
- **SaaS Readiness**: Packaged with automated billing, landing pages, lead capture, and a deployment playbook.

---

## 🧭 UX, Navigation & Global Shell

### 1. Unified App Shell & Command Centers
- **Design Tokens & Component Kit**: Premium enterprise SaaS aesthetics using a custom CSS tokens system (`tokens.css`). Features layered surfaces, hairline borders, smooth gradients, and a cohesive design system without relying on heavy frameworks.
- **Contextual Left Sidebar**: Links are grouped into 5 distinct Workspaces (Command Centers). The sidebar intelligently filters out links the user doesn't have permission to see.
  - `/command`: Executive Dashboard (Top-level KPIs).
  - `/ops/floor`: Operations (Work Orders, Maintenance, Scrap, Quality, Handover).
  - `/supply/vault`: Supply Chain (Inventory, BOM, Purchasing).
  - `/commercial/desk`: Commercial (Quotations, Invoices, Billing, Projects).
  - `/people/pulse`: People (Attendance, Payroll, Safety, Leaderboard, Audits).
- **Global Top Bar**:
  - **Breadcrumbs**: Dynamic path tracking.
  - **Cmd+K Search Palette**: Global fuzzy search for rapid navigation across the app (triggered by `Cmd+K` or search bar).
  - **Smart Notification Bell**: Groups notifications by Critical, Action, and Info categories.
  - **Plant Switcher**: Dropdown to switch context between different plants in a multi-plant enterprise.
  - **User Avatar**: Logout and account management.

### 2. Operator UI & Multilingual Support
- **Touch-First Terminal (`/terminal`)**: Big touch targets (48px+) optimized for shared shopfloor tablets.
- **Multilingual UI**: Native support for English (EN), Telugu (TE), and Hindi (HI) to accommodate diverse shopfloor workforces.
- **Offline Queue**: Actions performed on the terminal queue locally in `localStorage` when network connectivity drops, and auto-sync when back online.
- **Kiosk Mode & QR Integration**: Shared-tablet mode for rapid operator switching. Operators can scan QR codes attached to machines/badges to instantly log in and select their workstation.
- **PWA Installation**: Installable as a Progressive Web App on Android/iOS devices for native-like performance on the shopfloor.

---

## 🔒 Security & Access Control

### 1. Hierarchical RBAC ("Tree of Trust")
- **Role Model & Permission Keys**: Replaced fixed roles with dynamic `Role` models storing arrays of permission keys (e.g., `ops.view`, `ops.edit`, `system.edit`, `users.manage`, `reports.print`, `terminal.use`).
- **Tree of Trust Delegation**: Users can only create or manage roles/users whose permissions are a *strict subset* of their own permissions. An Operator cannot be elevated by a Supervisor to an Admin.
- **Org Tree Enforcement**: API endpoints filter data so users only see users they created, or the entire tree if they are the Owner.
- **Owner Lock**: The root `Owner` account cannot be deleted, demoted, or have its password revealed.
- **Access Control Pipeline**: Middleware and proxy injections pass the validated permissions directly into the request headers for zero-latency server-side authorization checks without DB hits (`getUserFromHeaders()`, `can()`).

### 2. Authentication
- **Local Credentials**: Bcrypt hashed passwords with mandatory "Change Password on First Login" flows.
- **Google SSO**: OAuth 2.0 integration via Google, rendering the login button dynamically if environment variables exist.
- **Admin Password Management**: Admins have an "eye" icon to reveal plain text initial passwords for rapid operator onboarding (audited via `PASSWORD_VIEWED`).

---

## 💰 Commercial, Sales & Finance

### 1. SaaS Billing, Paywall & Landing
- **Landing Page & Leads**: SEO-optimized public landing page capturing lead emails into the database.
- **Paywall & Billing (`/billing`)**: Integrated pricing tiers (Free/Pro/Enterprise) using Razorpay. Free-tier restrictions on Work Order limits, gracefully redirecting to the paywall when limits are hit.
- **Deployment Playbook**: Automated configuration checks.

### 2. Quotations & Smart Estimating (`/commercial/quotations`)
- **Smart Estimating Engine**: Computes unit costs automatically from BOM raw material prices + target labor/machine cycle time rates.
- **Loss Bidding Safeguard**: Flashes `🚨 BIDDING AT A LOSS` warning if calculated Margin % < 0.
- **1-Click Conversion**: Converts `WON` bids directly into actionable shopfloor Work Orders.

### 3. GST Tax Invoices & Payments (`/commercial/invoices`, `/reports/sales-register`)
- **Tax Calculation Engine**: Computes INTRA-State (CGST/SGST) and INTER-State (IGST) tax automatically based on configured company settings.
- **One Invoice Per Dispatch**: Strictly enforced relation between Dispatch Records and Tax Invoices.
- **Printable Legal Invoices**: Generates compliant Indian GST invoice PDFs with Indian Number-to-Words total conversion (e.g., "Rupees One Lakh...").
- **Payments & Receivables Aging**: Track `UNPAID`, `PARTIAL`, and `PAID` statuses. Dedicated Aging report for tracking overdue collections.

---

## 🏭 Operations & Core MES

### 1. Dashboards & Plant Monitoring
- **Executive Dashboard**: Plant OEE, Production Output, and Live Machine Grid showing real-time states (`RUNNING`, `DOWNTIME`, `IDLE`).
- **Andon Board**: High-visibility shopfloor screen summarizing machine status, current job progress, and active maintenance calls.
- **Schedule Board**: Visual Gantt-like view of planned work orders across machines.

### 2. Production, Handover & Reconcile
- **Production Logging**: Operators log Good, Scrap, and Rework quantities directly from the terminal.
- **Shift Handover**: Cross-shift WIP handoff validation. If the reported WIP on the floor doesn't match the system, an alert is flagged and reasons must be logged.
- **Reconciliation Engine**: Dedicated `/reconcile` tool for production managers to balance material consumed vs goods produced at the end of the day or month to spot variances.

---

## 📦 Supply Chain & Purchasing

### 1. Inventory & BOM (`/supply/vault`)
- **Raw Material Ledger**: Track `IN`, `OUT`, and `ADJUST` inventory transactions with full batch traceability.
- **Bill of Materials (BOM)**: Multi-component BOM specification per product. Calculates real-time BOM material cost vs standard cost.
- **Material Readiness Engine**: Compares open Work Order demand against current inventory levels to compute shortages and display `Short: <Material>` chips on the schedule board.

### 2. Purchasing
- **Purchase Orders (POs)**: Generate POs directly from material shortages. Track Supplier performance (On-Time In-Full, Lead Times).
- **Goods Receipt**: 1-click PO receipt automatically creates `IN` inventory transactions.

---

## 🛠️ Maintenance, Tooling & Senses (IoT)

### 1. Maintenance & Tool Life
- **Job Cards**: Track Breakdown and Preventive (PM) maintenance with Priority, Root Cause, Cost, and Labor Hours.
- **PM Rules & Tool Wear**: Tool life degrades automatically based on recorded machine cycles (`LOG_GOOD`). Visual percentage bars warn operators before catastrophic tool failure.

### 2. Senses: IoT & Utilities
- **IoT Simulator & Auto-Downtime**: Connects mock IoT sensors (or real MQTT streams) to machines. If an anomaly is detected (e.g., Spindle Temp High), the system *automatically* injects a Downtime log and pages maintenance.
- **Energy Costing**: Connects to utility sensors to estimate kWh consumption per job, dynamically injecting energy overhead into the Job Costing engine.
- **Capacity Heatmap**: Visual grid showing machine utilization percentages across days and shifts, aiding in load-balancing.

---

## 👥 People, Quality & Safety

### 1. Attendance & Payroll (`/people/pulse`)
- **Attendance Logging**: Operators clock in/out via terminal or supervisor dashboard.
- **Payroll & Overtime Engine**: Calculates regular pay, Overtime hours (with multiplier), and flags statutory compliance limits (>50h/month).
- **Payroll CSV Export**: Export monthly attendance and pay data directly to CSV for accounting integration.

### 2. Skills, Certifications & Safety Gates
- **Skill Matrix & Certifications**: Track operator competencies (e.g., "Forklift", "CNC Level 2").
- **Safety Gates**: If a Work Order requires a specific certification, the operator terminal blocks the user from starting the job unless their profile holds the active, unexpired certification.

### 3. Lean Six Sigma & Quality
- **First-Article Inspection (FAI)**: Mandates supervisor sign-off before a job can commence full production.
- **SPC & Quality Gates**: Log sample dimensions against Upper/Lower Spec Limits (USL/LSL).
- **Scrap & Rework Quarantines**: Material Review Board (MRB) dispositions to recover value from defective units.
- **5S, Kaizen & Safety**: Digital 5S audit forms, continuous improvement idea box, and Near-Miss safety incident logging with 5-Why root cause analysis.
- **Leaderboard**: Gamified cross-plant operator leaderboard.

---

## 🤖 Analytics & Scale

- **AI Analyst**: An interactive LLM-powered chat interface connected to the database to answer plain-English questions about plant performance ("Which machine had the most downtime this week?").
- **Saved Views**: Users can save custom table filters and sorts for rapid access to personalized reports.

---

## ✏️ Editability, Overrides & Audit Layer

Manufacturing Max utilizes a strict 3-tier editability and override system:

### 1. Source Records Editability
- Authorized roles can use the universal pencil icon (`SourceRecordEditModal.tsx`) to edit any historical log (Production, Downtime, Attendance, Movements, Inspections, etc.).
- **Audit Requirement**: Every edit mandates an explicit reason, permanently recorded in the `adjustmentHistory` JSON column and the system-wide `AuditLog`.

### 2. Manual Overrides Engine
- Allows authorized users to override computed system KPIs (e.g., Plant OEE, Job Margin) with manual values via the `OverrideBadgeModal.tsx`. Overridden values display an amber badge indicating manual intervention.

### 3. System Constants
- Hardcoded magic numbers are eliminated. The `/admin` constants tab manages global settings: OEE thresholds, Plan Gates, OT limits, upload limits, and PO multipliers.

---

## 📊 Reports & Print Center (`/reports`)

Clean interactive screen layouts and native CSS `@media print` optimized PDF layouts:

1. **Job Profitability Report**: Ranks jobs by Margin %, flagging loss-makers.
2. **Stock Register & Batch Ledger**: Comprehensive raw material movement.
3. **Inventory Valuation**: Current asset value per SKU.
4. **Material Requirement & Readiness**: Plant-wide material demand vs stock.
5. **PO Register & Supplier Scorecard**: Vendor rating and OTIF metrics.
6. **Maintenance Register**: Open jobs, PMs, and tool life.
7. **Overtime & Statutory Compliance**: Operator hours and OT pay.
8. **Morning Meeting Pack**: Executive daily briefing (KPIs, Pareto, 5S).
9. **Daily Production**: Shift-by-shift output and scrap.
10. **Downtime Report**: Stoppage logs and root causes.
11. **Performance & OEE**: Machine matrix of Availability, Performance, Quality.
12. **Job Traveler & Routing Card**: Physical shopfloor routing card for tracking WIP.
13. **5S Audit Sheet**: Completed audits and blank forms.
14. **Sales Register**: Taxable value and GST breakdown.
15. **Receivables Aging**: Overdue invoices tracking.
16. **Operator Efficiency Leaderboard**: Gamified rankings.
17. **Payroll Register**: CSV-ready compensation data.

---

## 🛢️ Database Schema Summary (`prisma/schema.prisma`)

- **Security & Multi-Tenant**: `User`, `Role`, `Plant`, `Setting`, `AuditLog`, `Override`.
- **Commercial & SaaS**: `Quotation`, `QuotationLine`, `Invoice`, `DispatchRecord`, `Subscription`, `Lead`.
- **Engineering & Production**: `Product`, `WorkOrder`, `Project`, `Operation`, `RoutingStep`, `BomLine`, `Document`.
- **Execution & Quality**: `ProductionLog`, `DowntimeLog`, `QualityInspection`, `ScrapQuarantine`, `ReworkOrder`.
- **Supply & Maintenance**: `RawMaterial`, `InventoryTransaction`, `Supplier`, `PurchaseOrder`, `MaintenanceJob`, `PMRule`, `MaintenanceTool`.
- **People & Lean**: `Shift`, `Assignment`, `AttendanceLog`, `Certification`, `SafetyIncident`, `FiveSAudit`, `Idea`, `RoutineStep`.

---

## 🚀 Environment & Deployment (Playbook)

- **Database**: `DATABASE_URL` (PostgreSQL/Neon).
- **SSO & Authentication**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`.
- **Payments**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- **Deployment**: Vercel-optimized (Serverless functions, Edge readiness for MW).
- **Commands**: `npx prisma db push`, `npx prisma generate`, `npx tsx prisma/seed.ts`, `npm run build`.

*Document Generated Automatically - Reflecting the Complete Validated Codebase State.*
