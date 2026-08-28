# Architecture & System Design

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon DB)
- **ORM:** Prisma
- **Styling:** Tailwind CSS (Vanilla CSS approach with tokens)
- **Icons:** Lucide React

## Folder Structure
- `/src/app` - Next.js App Router endpoints (Pages & API).
  - `/api` - Serverless API routes.
  - `/components` - Reusable UI components.
  - `/command` - Management dashboards.
  - `/terminal` - Operator terminal views.
  - `/reports` - Print-friendly report pages.
- `/src/lib` - Core engine files and utilities.
- `/prisma` - Database schema and migrations.

## Prisma Models (Comprehensive)
1. **Core:** Plant, ProductionLine, Machine, Shift, Setting, User, Role.
2. **Product & Planning:** Product, Operation, RoutingStep, BomLine, Document, QCParameter.
3. **Execution:** WorkOrder, ProductionLog, DowntimeLog, DowntimeReason, MovementLog.
4. **IoT & Telemetry:** TelemetryLog.
5. **Quality & Aero Compliance:** SerialUnit, SerialEvent, FaiReport, FaiCharacteristic, NcrReport, HoldPointSignoff, ScrapQuarantine, DefectCode, QualityMeasurement, QualityInspection, DataPackage.
6. **Change Management (ECO):** Eco, EcoItem.
7. **Supply Chain:** Supplier, RawMaterial, InventoryTransaction, PurchaseOrder, SupplierPayment, MaterialCert.
8. **Sales & Finance:** Quotation, QuotationLine, DispatchRecord, Invoice, Payment, PaymentRecord, Lead, CustomerComplaint.
9. **Maintenance & Tools:** MaintenanceJob, PMRule, MaintenanceTool, Tool.
10. **HR & Safety:** AttendanceLog, Assignment, LeaveRequest, ShiftHandover, SafetyIncident, SafetyAudit, Certification.
11. **Continuous Improvement:** ImprovementProject, RcaRecord, ActionItem, FiveSItem, FiveSAudit, FiveSAuditScore, Idea, RoutineStep, RoutineProgress.
12. **Audit & Query:** AuditLog, AnalystQuery, Override, ShiftCount.

## Engine Files (`/src/lib`)
- `costingEngine.ts`: Real-time cost rollups (material + labor + overhead).
- `readinessEngine.ts`: Validates if a Work Order is ready to start (material, certs, drawing validity).
- `otEngine.ts`: Operator terminal helper abstractions.
- `capacityEngine.ts`: Calculates load vs. capacity across machines based on standard times.
- `energyEngine.ts`: Manages kWh conversions and costing.
- `analystEngine.ts`: LLM integration for natural language querying of DB state.
- `permissionsEngine.ts`: RBAC subset evaluations.
- `overrideEngine.ts`: Tracks and applies manual system overrides.
- `audit.ts`: Universal mutation logger.

## File Storage Pattern
- **DB-Bytes Pattern:** Files (e.g., Documents, MaterialCerts) are stored directly in PostgreSQL as `Bytes` (`fileData Bytes`). This avoids external S3/Blob storage dependencies and ensures atomic backups, though it has strict limits (e.g., 4MB per file). 

## Environment Variables
- `DATABASE_URL`: Primary connection string to Neon DB.
- `NEXT_PUBLIC_APP_URL`: Base URL for absolute link generation (e.g., in reports).

## Deployment Notes
- **Platform:** Vercel
- **Limitations:** Serverless execution limit is configured (maxDuration) to prevent 10s timeouts. 
- **Filesystem:** Ephemeral. No local filesystem writes are allowed. All data must persist to Postgres.
