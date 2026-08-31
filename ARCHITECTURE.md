# Architecture & System Design

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon DB)
- **ORM:** Prisma
- **Styling:** Tailwind CSS (CSS Design Tokens in tokens.css)
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

## Multi-Plant & Campus Scoping Architecture
- **Dynamic Plant Resolution:** All plant bindings resolve dynamically via `src/lib/settings.ts` (`plantId` / `defaultPlantId` in the `Setting` table or `DEFAULT_PLANT_ID` env variable) rather than static hardcoded IDs.
- **Request & User Plant Scoping (`src/lib/plantScope.ts`):** 
  - `getPlantScope()` resolves current user / session selected facility (`selectedPlantId`) or operator `homePlantId`.
  - `withPlantScope(query, field)` filters entity queries to the active campus.
  - `resolvePlantId(explicitId)` safely guarantees multi-facility allocation.
- **Models with Multi-Plant Scoping:** `Plant`, `ProductionLine`, `Machine`, `WorkOrder`, `RawMaterial`, `InventoryTransaction`.

## Prisma Models (184 Models across Enterprise Subsystems)
1. **Core Enterprise & Auth (10):** Plant, ProductionLine, Machine, Shift, Setting, User, Role, Permission, Appraisal, LoginAttempt.
2. **Product Engineering & Routing (12):** Product, Operation, RoutingStep, BomLine, Document, QCParameter, Fixture, PartMarkingConfig, DrawingTransmittal, TransmittalRecipient, Eco, EcoItem.
3. **PPC & Shopfloor Execution (14):** WorkOrder, ProductionLog, DowntimeLog, DowntimeReason, MovementLog, ShiftRoster, ShiftRosterEntry, ShiftHandover, ShiftCount, Assignment, AssignmentOverride, ReworkRecord, ScrapQuarantine, KioskDevice.
4. **IoT, Telemetry & Factory+ (10):** TelemetryLog, SparkplugNode, SparkplugDevice, SparkplugMetric, UnsTopic, OpcUaNode, EnergyReading, UtilityConsumption, CncProgram, CncToolOffset.
5. **Quality, Aerospace & AS9100/IATF (24):** SerialUnit, SerialEvent, FaiReport, FaiCharacteristic, NcrReport, HoldPointSignoff, DefectCode, QualityMeasurement, QualityInspection, DataPackage, EightDReport, EightDTeamMember, EightDContainmentAction, EightDCause, EightDPermanentAction, EightDVerification, EightDPrevention, QualityObjective, ObjectiveMilestone, SpcChart, SpcSample, GaugeRnrStudy, GaugeRnrMeasurement, CalibrationRequisition.
6. **Supply Chain, Inventory & Procurement (22):** Supplier, RawMaterial, InventoryTransaction, PurchaseOrder, POLine, GoodsReceiptNote, GRNLine, MaterialCert, BinLocation, CycleCountSession, CycleCountLine, MaterialIssueSlip, MaterialIssueLine, PlantTransfer, PlantTransferLine, SubcontractPO, SubcontractPOLine, RateContract, ComparativeStatement, ComparativeQuote, WriteOffRequest, WriteOffLine.
7. **Maintenance & Metrology (16):** MaintenanceJob, PMRule, MaintenanceTool, Tool, CalibratedTool, MetrologyInspection, ToolRegrindLog, SparePart, PredictiveModelRun, VibrationReading, ThermalImageRecord, OilAnalysisSample, CoolantLog, CalibrationVendor, ReliabilityMetric, MaintenanceChecklist.
8. **Sales, Commercial & CRM (14):** Lead, Opportunity, Customer, CustomerContact, Quotation, QuotationLine, SalesOrder, SalesOrderLine, DispatchRecord, DispatchPackage, Invoice, InvoiceLine, Payment, PaymentRecord.
9. **Financial Accounting & Job Costing (12):** GeneralLedgerAccount, JournalEntry, JournalLine, CostCenter, FiscalPeriod, TaxRate, BudgetAllocation, FixedAsset, AssetDepreciationLog, BankAccount, BankTransaction, BankReconciliation.
10. **HR, Payroll & Time Office (18):** Department, Designation, AttendanceLog, AttendancePunt, LeaveRequest, LeaveBalance, Holiday, ShiftAllowance, OvertimeRecord, PayrollRun, Payslip, SalaryStructure, StatutoryRate, PFChallan, ESIChallan, Grievance, DisciplinaryAction, TrainingSession.
11. **EHS, Safety & Sustainability (14):** SafetyIncident, SafetyAudit, SafetyAuditItem, SafetyObservation, PPEInventory, PpeDistribution, HazWasteLog, CarbonEmissionRecord, ConsentToOperate, FireExtinguisher, MSDSDocument, SafetyTrainingRecord, NearMissReport, EnvironmentalPermit.
12. **Continuous Improvement & QMS (10):** ImprovementProject, RcaRecord, ActionItem, FiveSItem, FiveSAudit, FiveSAuditScore, Idea, KaizenReport, RoutineStep, RoutineProgress.
13. **Automation, Rules & Integration (8):** AutomationRule, AutomationAction, AutomationFlow, FlowNode, FlowEdge, WebhookSubscription, IntegrationCredential, ApiToken.

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
