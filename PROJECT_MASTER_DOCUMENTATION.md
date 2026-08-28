# Manufacturing-MAX — Master Project Documentation & AI Context Handover Guide

> **Purpose**: This document provides a complete, 100% self-contained technical blueprint, architectural summary, database reference, and feature directory for **Manufacturing-MAX**. Any AI assistant (such as Gemini in Antigravity IDE) or developer can consume this document to instantly continue development without missing any context.

---

## 1. Executive Summary & Application Purpose

**Manufacturing-MAX** is an enterprise-grade, real-time **Industry 4.0 Manufacturing Execution System (MES)** and Digital Lean Shopfloor Management platform built for discrete manufacturing plants (CNC machining, stamping press, assembly lines, robotic welding).

It eliminates paper travelers, manual downtime logs, inventory handoff disputes, and unmonitored tooling wear by offering a touch-optimized tablet interface for operators, real-time Andon displays, automated SPC, scrap quarantine (MRB), offline sync capabilities, and comprehensive executive reporting.

---

## 2. Tech Stack & Infrastructure

- **Framework**: Next.js 16.3.0 (App Router, Turbopack, Server & Client Components)
- **Language**: TypeScript 5 (Strict Mode, 0 type errors across all 49 routes)
- **Styling**: Tailwind CSS, Vanilla CSS, Custom Dark UI Aesthetics, Glassmorphism, Lucide React Icons
- **Database & ORM**: Prisma ORM 7.9.1 with Neon Serverless PostgreSQL (`db push`, `db seed`)
- **Offline Reliability**: Custom IndexedDB Sync Queue (`lib/offlineSync.ts`) with Last-Write-Wins and supervisor conflict tagging
- **Printing**: High-resolution print engine (`PrintWrapper.tsx`) for shopfloor traveler cards, shift handovers, 5S sheets, and morning meeting packs

---

## 3. Comprehensive Database Schema Reference (`prisma/schema.prisma`)

| Model | Key Fields | Business Purpose |
| :--- | :--- | :--- |
| `User` | `id, email, password, name, role (ADMIN/SUPERVISOR/OPERATOR)` | Authentication & role-based permissions |
| `Plant` & `Line` | `id, name, plantId` | Organizational hierarchy of factory floor |
| `Machine` | `id, name, code, status, lineId` | Live machine workstations (e.g. CNC Milling Bay 01, Lathe 03) |
| `Product` | `id, name, sku, targetCycleTimeSec` | Manufactured product catalog with ideal cycle times |
| `WorkOrder` | `id, woNumber, plannedQuantity, status, currentSeq` | Production jobs tracked by shopfloor sequence |
| `Operation` & `RoutingStep` | `id, code, sequence, stationName` | Step-by-step routing operations per product |
| `ProductionLog` | `id, machineId, workOrderId, goodQuantity, scrapQuantity, startTime, endTime` | Real-time output & yield logging |
| `DowntimeLog` | `id, machineId, reasonId, startTime, endTime, notes` | Machine stoppage tracking for OEE |
| `QualityInspection` | `id, workOrderId, result (PASS/FAIL), measuredValue` | SPC & quality assurance checks |
| `ShiftHandover` | `id, shiftDate, shiftName, outputQty, scrapQty, downtimeMinutes, missReason` | Shift reconciliation & plan-vs-actual accountability |
| `ShiftCount` | `id, machineId, outCount, inCount, status (AGREED/DISPUTED)` | Joint shift WIP inventory handoff reconciliation |
| `ScrapQuarantine` | `id, workOrderId, quantity, defectCode, status, costEstimate` | Material Review Board (MRB) scrap disposition |
| `ReworkOrder` | `id, quarantineId, targetMachineId, routingSteps, extraLaborHours` | Child work order routing for salvageable defective parts |
| `Tool` | `id, toolCode, maxLifeCycles, currentCycles, warningThreshold, status` | Real-time tool wear counters & preventive maintenance alerts |
| `Idea` | `id, title, description, category, upvotes, status` | Continuous Improvement / Kaizen employee idea box & upvoting board |
| `SafetyIncident` | `id, type, severity, location, status, capaOwner, fiveWhyReason` | Zero-Harm safety hazard, near-miss, and 5-Why CAPA triage |
| `FiveSAudit` & `FiveSItem` | `id, area, totalPct, auditorName, scores` | Digital 5S Lean discipline audits & area rankings |
| `RoutineStep` & `RoutineProgress` | `id, role, title, shifts, completed` | Shift leader & operator daily standardized work checklists |

---

## 4. Full Route Directory (49 Routes)

### Shopfloor & Operator Views
- `/operator`: Touch-optimized tablet workstation view with Live Work Order progress, Good/Scrap buttons, Shift WIP count, Tooling wear widget, Fast Safety Log modal, and Idea Submission modal.
- `/andon`: High-visibility TV display board showing real-time machine statuses (RUNNING, DOWN, IDLE), downtime timers, tool replacement warnings, and critical EHS safety alerts.
- `/reconcile`: Shift Plan-vs-Actual reconciliation page requiring supervisors to log mandatory miss-reasons when shift actuals fall below 95% of plan.
- `/handover`: Shift-change handover log with machine output, downtime minutes, and WIP inventory handoff agreement.

### Quality, Maintenance & Lean Modules
- `/tools`: Tool Life Tracking & Preventive Maintenance dashboard (wear progress bars, cycle counter resets, ROI analytics).
- `/scrap`: Scrap Material Review Board (MRB) quarantine queue for supervisor disposition (Scrap, Rework, Vendor Return) and Cost of Poor Quality (COPQ) analytics.
- `/rework`: Rework Order routing module generating child work orders for part restoration.
- `/safety`: Zero-Harm Safety & Near-Miss EHS dashboard featuring Hazard Triage, CAPA assignment, 5-Why root cause analysis, and Location x Severity risk heatmaps.
- `/ideas`: Employee Idea Box & Continuous Improvement dashboard featuring upvoting board, status pipeline, and Shopfloor Lean Contributor Leaderboard.
- `/fives`: 5S Audit & Lean Discipline board with interactive 15-item evaluation card, area rankings, and historical trend lines.
- `/spc`: Statistical Process Control dashboard with live X-bar & R charts, Cp/Cpk process capability analysis, and Rule violation flags.
- `/kaizen`: Kaizen & DMAIC project management portal with fishbone diagrams and 5-Why root cause tools.

### Reports & Print Center (`/reports`)
- `/reports`: Print Center hub with printable document cards.
- `/reports/morning-pack`: Tier-1 Operations Briefing Pack (KPIs, Plan-vs-Actual comparison, Pareto losses, Attendance, and top Implemented Kaizens).
- `/reports/traveler`: Job Traveler Card with routing sign-off lines and part movement history.
- `/reports/shift`: Print-friendly Shift Handover report.
- `/reports/downtime`: Machine downtime Pareto analysis.
- `/reports/performance`: Machine A/P/Q OEE performance report.
- `/reports/fives`: 5S Audit sheet & blank audit clipboard template.
- `/reports/daily`, `/reports/attendance`, `/reports/leaderboard`, `/reports/machine-history`, `/reports/operator-efficiency`.

### Core Operations & Management
- `/work-orders`: Work Order dispatch & sequencing queue.
- `/machines/[machineId]`: Machine deep-dive analytical view.
- `/schedule`: Visual Gantt schedule board for machine allocation.
- `/lean`: Overall OEE, Availability, Performance, and Quality metrics.
- `/leaderboard`: Operator productivity ranking and efficiency metrics.
- `/attendance`: Employee attendance logging and shift roll-call.
- `/digest`: Morning shift AI digest briefing.
- `/admin`: Master system administration (users, machines, defect codes, 5S items, routine templates).

---

## 5. How to Transfer & Resume this Project on another Gemini Account

### Step 1: Export Project File
Compress or push the `manufacturing-max` directory to a Git repository (GitHub / GitLab).

### Step 2: Share this Master Document
Provide `PROJECT_MASTER_DOCUMENTATION.md` to the new Gemini assistant or user.

### Step 3: Commands to Spin Up
```bash
# 1. Install dependencies
npm install

# 2. Synchronize PostgreSQL database schema
npx prisma db push

# 3. Seed database with realistic shopfloor data
npx prisma db seed

# 4. Verify TypeScript compilation
npx tsc --noEmit

# 5. Start development server
npm run dev
```

---

## 6. System Verification Status
- **TypeScript**: 0 errors (`npx tsc --noEmit` verified)
- **Next.js Production Build**: 49 static & dynamic routes compiled cleanly (`npm run build` verified)
- **Database Status**: Neon PostgreSQL synchronized and seeded
