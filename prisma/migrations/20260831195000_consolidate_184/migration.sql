-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RndProjectType" AS ENUM ('PRODUCTION', 'RND');

-- CreateEnum
CREATE TYPE "TestCampaignStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('PENDING', 'PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "UserLevel" AS ENUM ('WORKER', 'MANAGER');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "DowntimeCategory" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'MATERIAL', 'QUALITY', 'OPERATOR');

-- CreateEnum
CREATE TYPE "MachineState" AS ENUM ('RUNNING', 'IDLE', 'SETUP', 'FAULT', 'OFF');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('KAIZEN', 'DMAIC');

-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('DEFINE', 'MEASURE', 'ANALYZE', 'IMPROVE', 'CONTROL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "FishboneCategory" AS ENUM ('MAN', 'MACHINE', 'METHOD', 'MATERIAL', 'MEASUREMENT', 'ENVIRONMENT');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'WON', 'LOST', 'CONVERTED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('INTRA', 'INTER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "LogsheetStatus" AS ENUM ('OPEN', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SopDecisionType" AS ENUM ('OVERTIME', 'OUTSOURCE', 'EXTRA_SHIFT');

-- CreateEnum
CREATE TYPE "SopDecisionStatus" AS ENUM ('OPEN', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapacityWindowType" AS ENUM ('OUTSOURCE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE');

-- CreateEnum
CREATE TYPE "FiveSCategory" AS ENUM ('SORT', 'SET_IN_ORDER', 'SHINE', 'STANDARDIZE', 'SUSTAIN');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('CURRENT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MaintenanceJobType" AS ENUM ('BREAKDOWN', 'PM');

-- CreateEnum
CREATE TYPE "MaintenanceJobPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MaintenanceJobStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "ToolKind" AS ENUM ('DIE', 'MOULD', 'FIXTURE', 'BLADE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CL', 'SL', 'PL');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('QUALITY', 'DELIVERY', 'DAMAGE', 'WRONG_ITEM');

-- CreateEnum
CREATE TYPE "ComplaintSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'CAPA', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintDisposition" AS ENUM ('REPLACED', 'CREDIT_NOTE', 'REWORKED', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('BATCH', 'SERIAL');

-- CreateEnum
CREATE TYPE "SerialUnitStatus" AS ENUM ('WIP', 'COMPLETED', 'QUARANTINED', 'SHIPPED');

-- CreateEnum
CREATE TYPE "SerialEventType" AS ENUM ('OPERATION_COMPLETE', 'INSPECTION', 'NCR', 'MAINTENANCE', 'MOVEMENT');

-- CreateEnum
CREATE TYPE "FaiReportType" AS ENUM ('FULL', 'PARTIAL', 'DELTA');

-- CreateEnum
CREATE TYPE "FaiReportStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FaiCharStatus" AS ENUM ('PENDING', 'PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "NcrSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NcrStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'DISPOSITIONED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NcrDisposition" AS ENUM ('USE_AS_IS', 'REWORK', 'SCRAP', 'RETURN_TO_SUPPLIER');

-- CreateEnum
CREATE TYPE "NcrDispositionAuthority" AS ENUM ('QUALITY', 'ENGINEERING', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "CertType" AS ENUM ('MILL_CERT', 'COC', 'TEST_REPORT');

-- CreateEnum
CREATE TYPE "CalibratedToolType" AS ENUM ('GAUGE', 'TORQUE_WRENCH', 'CMM', 'MICROMETER');

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('OK', 'EXPIRING_SOON', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InstrumentLocation" AS ENUM ('LAB_CABINET', 'WITH_OPERATOR', 'SHOPFLOOR', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "InstrumentLifecycle" AS ENUM ('PROCUREMENT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "SpecialProcessType" AS ENUM ('HEAT_TREAT', 'PLATING', 'NDT', 'WELDING', 'ANODIZE');

-- CreateEnum
CREATE TYPE "SpecialProcessVendorStatus" AS ENUM ('APPROVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubcontractStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'PROCESSING', 'RECEIVED', 'QC_PASSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DataPackageStatus" AS ENUM ('DRAFT', 'RELEASED');

-- CreateEnum
CREATE TYPE "EcoStatus" AS ENUM ('DRAFT', 'APPROVED', 'IMPLEMENTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EcoEffectivityType" AS ENUM ('DATE', 'SERIAL');

-- CreateEnum
CREATE TYPE "EcoAction" AS ENUM ('REPLACE', 'ADD', 'REMOVE');

-- CreateEnum
CREATE TYPE "EcoEntityType" AS ENUM ('BOM', 'DRAWING', 'ROUTING');

-- CreateEnum
CREATE TYPE "EnvironmentalComplianceType" AS ENUM ('WASTE', 'EMISSION', 'EFFLUENT', 'PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ShipmentMode" AS ENUM ('AIR', 'SEA', 'ROAD', 'RAIL');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('EXW', 'FOB', 'CIF', 'CIP', 'DAP', 'DDP', 'OTHER');

-- CreateEnum
CREATE TYPE "TreasuryType" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "UtilityType" AS ENUM ('POWER', 'COMPRESSED_AIR', 'HVAC', 'WATER', 'GAS');

-- CreateEnum
CREATE TYPE "InfrastructureType" AS ENUM ('SERVER', 'NETWORK', 'WORKSTATION', 'PRINTER', 'UPS', 'OTHER');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('AVAILABLE', 'UNDER_MAINT', 'MISSING');

-- CreateEnum
CREATE TYPE "EightDStatus" AS ENUM ('D1_TEAM', 'D2_PROBLEM', 'D3_CONTAINMENT', 'D4_ROOT_CAUSE', 'D5_CORRECTIVE', 'D6_PREVENTIVE', 'D7_VERIFY', 'D8_CLOSURE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CapaActionType" AS ENUM ('CONTAINMENT', 'CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CapaActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED');

-- CreateEnum
CREATE TYPE "PpapStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PpapElementStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'N_A');

-- CreateEnum
CREATE TYPE "ControlPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "GrnInspectionStatus" AS ENUM ('PENDING', 'PASSED', 'REJECTED', 'HELD');

-- CreateEnum
CREATE TYPE "ThreeWayMatchStatus" AS ENUM ('UNMATCHED', 'PARTIAL', 'MATCHED', 'MISMATCHED');

-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('UNPAID', 'MATCHED', 'MISMATCHED', 'PAID');

-- CreateEnum
CREATE TYPE "GrrVerdict" AS ENUM ('ACCEPTABLE', 'CONDITIONAL', 'UNACCEPTABLE');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PAYMENT', 'RECEIPT', 'JOURNAL', 'DEPRECIATION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('PENDING_CHECK', 'POSTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FixedAssetCategory" AS ENUM ('MACHINERY', 'VEHICLE', 'FURNITURE_FIXTURES', 'COMPUTER_EQUIPMENT', 'EQUIPMENT', 'BUILDING', 'LAND', 'OTHER');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'WDV');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED');

-- CreateEnum
CREATE TYPE "GstReconStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PLANNED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TrainingAttendanceStatus" AS ENUM ('SCHEDULED', 'ATTENDED', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "GrievanceStage" AS ENUM ('RAISED', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisciplinaryStage" AS ENUM ('NOTICE', 'HEARING', 'DECISION', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisciplinaryDecision" AS ENUM ('NO_ACTION', 'WARNING', 'FINAL_WARNING', 'SUSPENSION', 'TERMINATION');

-- CreateEnum
CREATE TYPE "PpeCategory" AS ENUM ('HELMET', 'SAFETY_SHOES', 'SAFETY_GLASSES', 'GLOVES', 'RESPIRATOR', 'EARPLUGS', 'FACE_SHIELD', 'HARNESS', 'APRON', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('WATER', 'AIR');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "HazWasteCategory" AS ENUM ('HAZARDOUS', 'NON_HAZARDOUS');

-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('GENERATED', 'IN_TRANSIT', 'DISPOSED');

-- CreateEnum
CREATE TYPE "ExtinguisherType" AS ENUM ('DCP', 'CO2', 'FOAM', 'WATER', 'CLEAN_AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ItAssetType" AS ENUM ('LAPTOP', 'DESKTOP', 'MONITOR', 'MOBILE', 'PRINTER', 'SERVER', 'NETWORK', 'UPS', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCESS', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "EnergyReading" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalKwh" DOUBLE PRECISION NOT NULL,
    "unitCostPerKwh" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EnergyReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "city" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "plantId" TEXT,
    "idealCycleTimeSeconds" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "currentState" "MachineState" NOT NULL DEFAULT 'OFF',
    "lastPingAt" TIMESTAMP(3),
    "iotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stationName" TEXT,
    "oeeTarget" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "oeeGoodThreshold" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "oeeWarningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryLog" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "state" "MachineState" NOT NULL,
    "cycleCount" INTEGER,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCycleTimeSeconds" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingStep" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "machineId" TEXT,
    "seq" INTEGER NOT NULL,
    "stationName" TEXT NOT NULL,
    "standardCycleTimeSeconds" DOUBLE PRECISION,
    "setupTimeMin" INTEGER NOT NULL DEFAULT 15,
    "cycleTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "instructions" TEXT,
    "isHoldPoint" BOOLEAN NOT NULL DEFAULT false,
    "holdAuthority" TEXT,
    "specialProcessVendorId" TEXT,

    CONSTRAINT "RoutingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "targetCompletionDate" TIMESTAMP(3) NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'OPEN',
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "description" TEXT,
    "projectType" "RndProjectType" NOT NULL DEFAULT 'PRODUCTION',
    "salesOwner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementLog" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStation" TEXT NOT NULL,
    "toStation" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movedByName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentHistory" JSONB,

    CONSTRAINT "MovementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "targetCycleTimeSeconds" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "materialCostPerUnit" DOUBLE PRECISION,
    "sellingPricePerUnit" DOUBLE PRECISION,
    "toolingCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRoster" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Logsheet" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "operatorId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "entries" JSONB NOT NULL,
    "remarks" TEXT,
    "status" "LogsheetStatus" NOT NULL DEFAULT 'OPEN',
    "submittedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Logsheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceAppraisal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "efficiencyPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attendancePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "managerRating" INTEGER,
    "managerComments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AUTO',
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceAppraisal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "employeeNumber" TEXT,
    "passwordHash" TEXT,
    "lastSetPassword" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "roleId" TEXT,
    "createdById" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "level" "UserLevel" NOT NULL DEFAULT 'WORKER',
    "homePlantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "prefs" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionAccount" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "collectorId" TEXT,
    "dunningLevel" INTEGER NOT NULL DEFAULT 0,
    "lastDunningAt" TIMESTAMP(3),
    "followUps" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedByName" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "corrections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "createdById" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "woNumber" TEXT NOT NULL,
    "trackingMode" "TrackingMode" NOT NULL DEFAULT 'BATCH',
    "productId" TEXT NOT NULL,
    "plantId" TEXT,
    "plannedQuantity" INTEGER NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "setupTimeMinutes" DOUBLE PRECISION,
    "cycleTimeSeconds" DOUBLE PRECISION,
    "iteration" INTEGER NOT NULL DEFAULT 1,
    "currentSeq" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 500,
    "toolingCostRupees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "promisedDispatchDate" TIMESTAMP(3),
    "trackingToken" TEXT,
    "quotedPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,
    "faiRequired" BOOLEAN NOT NULL DEFAULT false,
    "materialCostTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packedQuantity" INTEGER NOT NULL DEFAULT 0,
    "eanCode" TEXT,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLog" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "operatorId" TEXT,
    "shiftId" TEXT,
    "goodQuantity" INTEGER NOT NULL DEFAULT 0,
    "scrapQuantity" INTEGER NOT NULL DEFAULT 0,
    "reworkQuantity" INTEGER NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LogStatus" NOT NULL DEFAULT 'DRAFT',
    "adjustmentHistory" JSONB,

    CONSTRAINT "ProductionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DowntimeReason" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "nameTe" TEXT,
    "nameHi" TEXT,
    "category" "DowntimeCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "affectsOperatorScore" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DowntimeReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DowntimeLog" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "reasonId" TEXT,
    "operatorId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LogStatus" NOT NULL DEFAULT 'DRAFT',
    "adjustmentHistory" JSONB,

    CONSTRAINT "DowntimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "nameTe" TEXT,
    "nameHi" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DefectCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityMeasurement" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "characteristic" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "lsl" DOUBLE PRECISION NOT NULL,
    "usl" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "totalInspected" INTEGER NOT NULL,
    "passed" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "defectCodeId" TEXT,
    "calibratedToolId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentHistory" JSONB,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectType" NOT NULL,
    "phase" "ProjectPhase" NOT NULL DEFAULT 'DEFINE',
    "status" "ProjectStatus" NOT NULL DEFAULT 'OPEN',
    "ownerName" TEXT NOT NULL,
    "machineId" TEXT,
    "expectedAnnualSavings" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcaRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "problemStatement" TEXT,
    "why1" TEXT,
    "why2" TEXT,
    "why3" TEXT,
    "why4" TEXT,
    "why5" TEXT,
    "rootCause" TEXT,
    "fishboneCategory" "FishboneCategory",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftHandover" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "machineId" TEXT,
    "productionNotes" TEXT NOT NULL,
    "downtimeNotes" TEXT NOT NULL,
    "safetyNotes" TEXT NOT NULL,
    "nextShiftActions" TEXT NOT NULL,
    "missReason" TEXT,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "openBreakdowns" JSONB,
    "openNcrs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentHistory" JSONB,

    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DpmBlocker" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerDept" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "workOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raisedBy" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DpmBlocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentOverride" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "machineId" TEXT,
    "assignedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopDecision" (
    "id" TEXT NOT NULL,
    "decisionNumber" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "decisionType" "SopDecisionType" NOT NULL,
    "gapHours" DOUBLE PRECISION NOT NULL,
    "requiredHours" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" "SopDecisionStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" JSONB,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SopDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityWindow" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "windowType" "CapacityWindowType" NOT NULL,
    "title" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION,
    "reason" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRevision" (
    "id" TEXT NOT NULL,
    "revisionNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "oldPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "increasePct" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentHistory" JSONB,

    CONSTRAINT "PriceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOut" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpointKey" TEXT NOT NULL,
    "config" JSONB,
    "lastSeen" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineStep" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "timeLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSItem" (
    "id" TEXT NOT NULL,
    "category" "FiveSCategory" NOT NULL,
    "seq" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveSItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSAudit" (
    "id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "auditorName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalPct" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveSAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSAuditScore" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "FiveSAuditScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftCount" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "fromShiftId" TEXT NOT NULL,
    "toShiftId" TEXT,
    "outgoingUserId" TEXT NOT NULL,
    "incomingUserId" TEXT,
    "outCount" INTEGER NOT NULL,
    "inCount" INTEGER,
    "finalCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "ShiftCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapQuarantine" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "defectCode" TEXT NOT NULL,
    "loggedBy" TEXT NOT NULL DEFAULT 'Operator',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dispositionNotes" TEXT,
    "costEstimate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "ScrapQuarantine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReworkOrder" (
    "id" TEXT NOT NULL,
    "quarantineId" TEXT NOT NULL,
    "targetMachineId" TEXT NOT NULL,
    "routingSteps" TEXT NOT NULL,
    "extraLaborHours" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "ReworkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "toolCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxLifeCycles" INTEGER NOT NULL,
    "currentCycles" INTEGER NOT NULL DEFAULT 0,
    "warningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedMachineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'SAFETY',
    "description" TEXT NOT NULL,
    "submitter" TEXT NOT NULL DEFAULT 'Operator',
    "submittedBy" TEXT,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "adjustmentHistory" JSONB,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL DEFAULT 'Operator',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "capaOwner" TEXT,
    "dueDate" TIMESTAMP(3),
    "capaDueDate" TIMESTAMP(3),
    "rootCause" TEXT,
    "fiveWhyReason" TEXT,
    "actionTaken" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "adjustmentHistory" JSONB,
    "machineId" TEXT,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyAudit" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditorName" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "certifiedBy" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "gstin" TEXT,
    "state" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactPhone" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "defaultLeadDays" INTEGER,
    "paymentTerms" TEXT NOT NULL DEFAULT 'NET30',
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "gstin" TEXT,
    "paymentTerms" TEXT NOT NULL DEFAULT 'NET30',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "materialClass" TEXT DEFAULT 'C',
    "plantId" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentHistory" JSONB,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "plantId" TEXT,
    "batchNo" TEXT,
    "reference" TEXT,
    "workOrderId" TEXT,
    "actorName" TEXT NOT NULL DEFAULT 'Storekeeper',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentHistory" JSONB,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'ORDERED',
    "expectedDate" TIMESTAMP(3),
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvalLevel" TEXT,
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "ownerApprovedBy" TEXT,
    "ownerApprovedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinLocation" (
    "id" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "rawMaterialId" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WriteOffRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WriteOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativeStatement" (
    "id" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "requiredBy" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "awardedQuoteId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparativeStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativeQuote" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "unitRate" DOUBLE PRECISION NOT NULL,
    "leadDays" INTEGER NOT NULL DEFAULT 7,
    "paymentTerms" TEXT DEFAULT 'NET30',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparativeQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateContract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "lanes" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "isApproved" BOOLEAN DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightDispatch" (
    "id" TEXT NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reference" TEXT,
    "route" TEXT,
    "vehicleNumber" TEXT,
    "pickupDate" TIMESTAMP(3),
    "promisedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "charges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "qtyPerUnit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "operationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "sizeKb" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'CURRENT',
    "uploadedBy" TEXT NOT NULL DEFAULT 'Admin',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "adjustmentHistory" JSONB,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceJob" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "type" "MaintenanceJobType" NOT NULL,
    "priority" "MaintenanceJobPriority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "status" "MaintenanceJobStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "rootCause" TEXT,
    "countermeasure" TEXT,
    "partsUsed" TEXT,
    "costRupees" DOUBLE PRECISION,
    "laborHours" DOUBLE PRECISION,
    "kitId" TEXT,
    "adjustmentHistory" JSONB,

    CONSTRAINT "MaintenanceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PMRule" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "intervalRunHours" DOUBLE PRECISION,
    "lastDoneAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kitId" TEXT,
    "adjustmentHistory" JSONB,

    CONSTRAINT "PMRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTool" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "machineId" TEXT,
    "kind" "ToolKind" NOT NULL,
    "ratedLifeUnits" DOUBLE PRECISION NOT NULL,
    "usedUnits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regrinds" INTEGER NOT NULL DEFAULT 0,
    "maxRegrinds" INTEGER NOT NULL DEFAULT 3,
    "lifeStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "lastChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentHistory" JSONB,

    CONSTRAINT "MaintenanceTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolLifeLog" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "woNumber" TEXT,
    "woId" TEXT,
    "costRupees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolLifeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeanObservation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "estMinutesSaved" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "observedBy" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "implementedAt" TIMESTAMP(3),
    "implementedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeanObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Override" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerContact" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quotedPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "workOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,
    "lastFollowUpAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "followUps" JSONB,
    "wonReason" TEXT,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountApprovalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "discountApprovedBy" TEXT,
    "discountApprovedAt" TIMESTAMP(3),
    "discountRejectedBy" TEXT,
    "discountRejectReason" TEXT,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "plannedQty" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchRecord" (
    "id" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "dispatchedQty" INTEGER NOT NULL,
    "carrierName" TEXT,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "ewayBillNo" TEXT,
    "gatePassNumber" TEXT,
    "securityCheckedBy" TEXT,
    "dispatchedByName" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "adjustmentHistory" JSONB,

    CONSTRAINT "DispatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receivedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "dispatchRecordId" TEXT,
    "workOrderId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerGstin" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxableValue" DOUBLE PRECISION NOT NULL,
    "taxType" "TaxType" NOT NULL DEFAULT 'INTRA',
    "taxRatePct" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "cgstAmt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgstAmt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igstAmt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adjustmentHistory" JSONB,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalystQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerTitle" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalystQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extendsUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "campaignId" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequisition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'SCREENING',
    "source" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "interviewType" TEXT NOT NULL DEFAULT 'TECHNICAL',
    "panelist" TEXT,
    "feedback" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerComplaint" (
    "id" TEXT NOT NULL,
    "complaintNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "workOrderId" TEXT,
    "invoiceId" TEXT,
    "batchNo" TEXT,
    "type" "ComplaintType" NOT NULL,
    "severity" "ComplaintSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "returnedQty" DOUBLE PRECISION,
    "rootCause" TEXT,
    "capaAction" TEXT,
    "disposition" "ComplaintDisposition",
    "ackDeadline" TIMESTAMP(3),
    "ackAt" TIMESTAMP(3),
    "eightDDeadline" TIMESTAMP(3),
    "eightDClosedAt" TIMESTAMP(3),
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialUnit" (
    "id" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currentSeq" INTEGER NOT NULL DEFAULT 1,
    "status" "SerialUnitStatus" NOT NULL DEFAULT 'WIP',
    "bornAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3),

    CONSTRAINT "SerialUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialEvent" (
    "id" TEXT NOT NULL,
    "serialUnitId" TEXT NOT NULL,
    "type" "SerialEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QCParameter" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "charNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "lsl" DOUBLE PRECISION,
    "usl" DOUBLE PRECISION,
    "method" TEXT,

    CONSTRAINT "QCParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaiReport" (
    "id" TEXT NOT NULL,
    "faiNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "serialUnitId" TEXT,
    "productId" TEXT NOT NULL,
    "drawingRevision" TEXT,
    "customerName" TEXT,
    "type" "FaiReportType" NOT NULL DEFAULT 'FULL',
    "status" "FaiReportStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "preparedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaiCharacteristic" (
    "id" TEXT NOT NULL,
    "faiReportId" TEXT NOT NULL,
    "charNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "lsl" DOUBLE PRECISION,
    "usl" DOUBLE PRECISION,
    "actual" DOUBLE PRECISION,
    "method" TEXT,
    "status" "FaiCharStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "FaiCharacteristic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NcrReport" (
    "id" TEXT NOT NULL,
    "ncrNumber" TEXT NOT NULL,
    "quarantineId" TEXT,
    "workOrderId" TEXT,
    "serialUnitId" TEXT,
    "productId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "defectCodeId" TEXT,
    "severity" "NcrSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "containmentAction" TEXT,
    "why1" TEXT,
    "why2" TEXT,
    "why3" TEXT,
    "why4" TEXT,
    "why5" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "status" "NcrStatus" NOT NULL DEFAULT 'OPEN',
    "disposition" "NcrDisposition",
    "dispositionAuthority" "NcrDispositionAuthority",
    "customerNotification" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "raisedBy" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "supplierId" TEXT,
    "grnId" TEXT,

    CONSTRAINT "NcrReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCert" (
    "id" TEXT NOT NULL,
    "inventoryTransactionId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "supplierId" TEXT,
    "heatNumber" TEXT NOT NULL,
    "certNumber" TEXT,
    "certType" "CertType" NOT NULL DEFAULT 'MILL_CERT',
    "specGrade" TEXT,
    "mimeType" TEXT,
    "fileData" BYTEA,
    "sizeKb" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL DEFAULT 'Storekeeper',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoldPointSignoff" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "routingStepId" TEXT NOT NULL,
    "serialUnitId" TEXT,
    "inspectorName" TEXT NOT NULL,
    "inspectorOrg" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "remarks" TEXT,
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldPointSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibratedTool" (
    "id" TEXT NOT NULL,
    "toolType" "CalibratedToolType" NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "certNumber" TEXT,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'OK',
    "location" "InstrumentLocation" NOT NULL DEFAULT 'LAB_CABINET',
    "lifecycle" "InstrumentLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "calibrationIntervalDays" INTEGER,
    "custodianName" TEXT,
    "certFileData" BYTEA,
    "certFileMime" TEXT,
    "certFileSizeKb" INTEGER,
    "costRupees" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibratedTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentIssue" (
    "id" TEXT NOT NULL,
    "calibratedToolId" TEXT NOT NULL,
    "issuedToName" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnedToName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialProcessVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "processType" "SpecialProcessType" NOT NULL,
    "nadcapCertNumber" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "SpecialProcessVendorStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialProcessVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractChallan" (
    "id" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "dispatchedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturn" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "vehicleNumber" TEXT,
    "status" "SubcontractStatus" NOT NULL DEFAULT 'DISPATCHED',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataPackage" (
    "id" TEXT NOT NULL,
    "packageNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "status" "DataPackageStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB,
    "releasedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eco" (
    "id" TEXT NOT NULL,
    "ecoNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "EcoStatus" NOT NULL DEFAULT 'DRAFT',
    "effectivityType" "EcoEffectivityType" NOT NULL DEFAULT 'DATE',
    "effectivityValue" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Eco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcoItem" (
    "id" TEXT NOT NULL,
    "ecoId" TEXT NOT NULL,
    "entityType" "EcoEntityType" NOT NULL,
    "productId" TEXT NOT NULL,
    "action" "EcoAction" NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCampaign" (
    "id" TEXT NOT NULL,
    "campaignNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TestCampaignStatus" NOT NULL DEFAULT 'PLANNED',
    "testCostRupees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRecord" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "unit" TEXT,
    "target" DOUBLE PRECISION,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "actual" DOUBLE PRECISION,
    "result" "TestResult" NOT NULL DEFAULT 'PENDING',
    "testedBy" TEXT,
    "testedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutoryContribution" (
    "id" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeCode" TEXT,
    "month" TEXT NOT NULL,
    "pfNumber" TEXT,
    "esiNumber" TEXT,
    "pfWage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pfEmployee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pfEmployer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esiWage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esiEmployee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esiEmployer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatutoryContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheckRecord" (
    "id" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeCode" TEXT,
    "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodPressure" TEXT,
    "vision" TEXT,
    "audiometry" TEXT,
    "weightKg" DOUBLE PRECISION,
    "fitnessStatus" TEXT NOT NULL DEFAULT 'FIT',
    "notes" TEXT,
    "conductedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheckRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalRecord" (
    "id" TEXT NOT NULL,
    "recordType" "EnvironmentalComplianceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "permitNumber" TEXT,
    "complianceStatus" TEXT NOT NULL DEFAULT 'COMPLIANT',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "owner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FireDrillRecord" (
    "id" TEXT NOT NULL,
    "drillDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT NOT NULL,
    "participants" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "conductedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FireDrillRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EximShipment" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "shipmentType" TEXT NOT NULL DEFAULT 'EXPORT',
    "mode" "ShipmentMode" NOT NULL DEFAULT 'AIR',
    "incoterm" "Incoterm" NOT NULL DEFAULT 'FOB',
    "port" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "workOrderId" TEXT,
    "customerName" TEXT,
    "customsValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shipmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "notes" TEXT,
    "vesselName" TEXT,
    "voyageNo" TEXT,
    "blNumber" TEXT,
    "bookingDate" TIMESTAMP(3),
    "sailingDate" TIMESTAMP(3),
    "customsClearDate" TIMESTAMP(3),
    "arrivalDate" TIMESTAMP(3),
    "docCi" BOOLEAN NOT NULL DEFAULT false,
    "docPl" BOOLEAN NOT NULL DEFAULT false,
    "docCoO" BOOLEAN NOT NULL DEFAULT false,
    "docBl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EximShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorUpdate" (
    "id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ebitda" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordersBooked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "allocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryTransaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TreasuryType" NOT NULL,
    "account" TEXT NOT NULL DEFAULT 'Main',
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityReading" (
    "id" TEXT NOT NULL,
    "utilityType" "UtilityType" NOT NULL,
    "meterName" TEXT,
    "reading" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kWh',
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineCode" TEXT,
    "currentQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplierName" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "abcClass" TEXT,
    "vedClass" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 15,
    "avgDailyUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderPoint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "poReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureAsset" (
    "id" TEXT NOT NULL,
    "assetType" "InfrastructureType" NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "warrantyUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "sizeMb" DOUBLE PRECISION,
    "target" TEXT NOT NULL DEFAULT 'PostgreSQL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QmsAudit" (
    "id" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "standard" TEXT NOT NULL DEFAULT 'AS9100',
    "auditType" TEXT NOT NULL DEFAULT 'INTERNAL',
    "auditor" TEXT,
    "auditeeDept" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "result" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QmsAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QmsAuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "clause" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MINOR',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "correctiveAction" TEXT,
    "ncrId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QmsAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'DIGITAL',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "designation" TEXT,
    "basicPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specialAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conveyance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pfPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "professionalTax" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "pfDeduction" DOUBLE PRECISION NOT NULL,
    "ptDeduction" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "otHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION,
    "matchedTreasuryId" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "uploadBatch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDigestLog" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientEmails" TEXT NOT NULL DEFAULT '[]',
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LOGGED',

    CONSTRAINT "ComplianceDigestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierScorecard" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "onTimeDelivery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityPpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costVariance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responsiveness" INTEGER NOT NULL DEFAULT 3,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'C',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeStudy" (
    "id" TEXT NOT NULL,
    "productSku" TEXT,
    "operationName" TEXT NOT NULL,
    "department" TEXT,
    "standardTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "measuredTimeMin" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT,
    "machineId" TEXT,
    "status" "FixtureStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT,
    "procurementCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingTransmittal" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedBy" TEXT NOT NULL,
    "ackProduction" BOOLEAN NOT NULL DEFAULT false,
    "ackProductionBy" TEXT,
    "ackProductionAt" TIMESTAMP(3),
    "ackQuality" BOOLEAN NOT NULL DEFAULT false,
    "ackQualityBy" TEXT,
    "ackQualityAt" TIMESTAMP(3),

    CONSTRAINT "DrawingTransmittal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "escalatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MrmMeeting" (
    "id" TEXT NOT NULL,
    "meetingNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "attendees" JSONB NOT NULL,
    "agenda" JSONB NOT NULL,
    "summary" TEXT,
    "decisions" JSONB,
    "minutesBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MrmMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MrmActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MrmActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityObjective" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "kpiType" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "ownerName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EightDReport" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "ncrId" TEXT,
    "complaintId" TEXT,
    "workOrderId" TEXT,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "problemDescription" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" "EightDStatus" NOT NULL DEFAULT 'D1_TEAM',
    "teamMembers" TEXT,
    "problemStatement" TEXT,
    "containmentAction" TEXT,
    "containmentOwner" TEXT,
    "containmentDue" TIMESTAMP(3),
    "why1" TEXT,
    "why2" TEXT,
    "why3" TEXT,
    "why4" TEXT,
    "why5" TEXT,
    "rootCauseSummary" TEXT,
    "correctiveAction" TEXT,
    "correctiveOwner" TEXT,
    "correctiveDue" TIMESTAMP(3),
    "preventiveAction" TEXT,
    "preventiveOwner" TEXT,
    "preventiveDue" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "effectivenessScore" INTEGER,
    "closureSummary" TEXT,
    "closedAt" TIMESTAMP(3),
    "raisedBy" TEXT NOT NULL DEFAULT 'System',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EightDReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaAction" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "type" "CapaActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "CapaActionStatus" NOT NULL DEFAULT 'OPEN',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpapSubmission" (
    "id" TEXT NOT NULL,
    "ppapNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerName" TEXT,
    "revision" TEXT NOT NULL DEFAULT 'A',
    "submissionLevel" INTEGER NOT NULL DEFAULT 3,
    "status" "PpapStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "dispositionAt" TIMESTAMP(3),
    "dispositionBy" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PpapSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpapElement" (
    "id" TEXT NOT NULL,
    "ppapId" TEXT NOT NULL,
    "elementNo" INTEGER NOT NULL,
    "elementName" TEXT NOT NULL,
    "status" "PpapElementStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PpapElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlPlan" (
    "id" TEXT NOT NULL,
    "planNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "revision" TEXT NOT NULL DEFAULT 'A',
    "status" "ControlPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "processStep" TEXT,
    "characteristic" TEXT NOT NULL,
    "specMin" DOUBLE PRECISION,
    "specMax" DOUBLE PRECISION,
    "measurementMethod" TEXT,
    "sampleSize" INTEGER,
    "frequency" TEXT,
    "controlMethod" TEXT,
    "reactionPlan" TEXT,
    "responsible" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "reqNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "itemName" TEXT,
    "qty" DOUBLE PRECISION,
    "unit" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "assignedByName" TEXT,
    "assignedAt" TIMESTAMP(3),
    "poNumber" TEXT,
    "requestedBy" TEXT NOT NULL DEFAULT 'Stores',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoFollowUpLog" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoFollowUpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCountSession" (
    "id" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abcClass" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startedBy" TEXT NOT NULL DEFAULT 'Stores',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,

    CONSTRAINT "CycleCountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCountLine" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "systemQty" DOUBLE PRECISION NOT NULL,
    "countedQty" DOUBLE PRECISION,
    "variance" DOUBLE PRECISION,
    "variancePct" DOUBLE PRECISION,
    "countedBy" TEXT,
    "countedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,

    CONSTRAINT "CycleCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssueSlip" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "batchNo" TEXT,
    "heatNo" TEXT,
    "issuedBy" TEXT NOT NULL DEFAULT 'Storekeeper',
    "issuedTo" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialIssueSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalLabRequisition" (
    "id" TEXT NOT NULL,
    "reqNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vendorId" TEXT,
    "vendorName" TEXT,
    "estimatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "instruments" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "requestedBy" TEXT NOT NULL DEFAULT 'Metrology',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalLabRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalLabVendorRating" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "onTimeDelivery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certQuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'C',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalLabVendorRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpccChecklistRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "operatorId" TEXT,
    "processStep" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "ncrId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IpccChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpccCheckResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "characteristic" TEXT NOT NULL,
    "processStep" TEXT,
    "specMin" DOUBLE PRECISION,
    "specMax" DOUBLE PRECISION,
    "uom" TEXT,
    "measurementMethod" TEXT,
    "sampleSize" INTEGER,
    "frequency" TEXT,
    "controlMethod" TEXT,
    "measuredValue" DOUBLE PRECISION,
    "valueText" TEXT,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "recordedAt" TIMESTAMP(3),
    "recordedBy" TEXT,

    CONSTRAINT "IpccCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptNote" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "receivedQty" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT NOT NULL DEFAULT 'Storekeeper',
    "batchNo" TEXT,
    "inspectionStatus" "GrnInspectionStatus" NOT NULL DEFAULT 'PENDING',
    "inspector" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "matchStatus" "ThreeWayMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "notes" TEXT,
    "lotHeld" BOOLEAN NOT NULL DEFAULT false,
    "aqlSampleSize" INTEGER,
    "ncrId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AqlPlan" (
    "id" TEXT NOT NULL,
    "materialClass" TEXT NOT NULL,
    "aqlLevel" TEXT NOT NULL DEFAULT 'II',
    "sampleSize" INTEGER NOT NULL,
    "acceptanceNumber" INTEGER NOT NULL,
    "rejectionNumber" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AqlPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FqcChecklist" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "finalInspectionPassed" BOOLEAN NOT NULL DEFAULT false,
    "packingDone" BOOLEAN NOT NULL DEFAULT false,
    "docPackDone" BOOLEAN NOT NULL DEFAULT false,
    "inspector" TEXT NOT NULL DEFAULT '',
    "checkedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FqcChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QmsDocument" (
    "id" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'PROCEDURE',
    "owner" TEXT NOT NULL DEFAULT 'Quality Manager',
    "revision" TEXT NOT NULL DEFAULT 'A',
    "status" TEXT NOT NULL DEFAULT 'CURRENT',
    "approvedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QmsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poId" TEXT,
    "grnId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GageRnrStudy" (
    "id" TEXT NOT NULL,
    "studyNumber" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "appraisers" INTEGER NOT NULL DEFAULT 3,
    "parts" INTEGER NOT NULL DEFAULT 10,
    "trials" INTEGER NOT NULL DEFAULT 3,
    "measurements" JSONB NOT NULL,
    "ev" DOUBLE PRECISION,
    "av" DOUBLE PRECISION,
    "grr" DOUBLE PRECISION,
    "partVar" DOUBLE PRECISION,
    "totalVar" DOUBLE PRECISION,
    "grrPct" DOUBLE PRECISION,
    "ndc" INTEGER,
    "verdict" "GrrVerdict",
    "conductedBy" TEXT NOT NULL DEFAULT 'System',
    "conductedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GageRnrStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitToWork" (
    "id" TEXT NOT NULL,
    "permitNo" TEXT NOT NULL,
    "maintenanceJobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ehsApprovedBy" TEXT,
    "ehsApprovedAt" TIMESTAMP(3),
    "ehsApprovedReason" TEXT,
    "maintApprovedBy" TEXT,
    "maintApprovedAt" TIMESTAMP(3),
    "maintApprovedReason" TEXT,
    "prodApprovedBy" TEXT,
    "prodApprovedAt" TIMESTAMP(3),
    "prodApprovedReason" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "adjustmentHistory" JSONB,

    CONSTRAINT "PermitToWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessReviewCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "AccessReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCertification" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "depts" TEXT[],
    "certifiedBy" TEXT NOT NULL,
    "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "AccessCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreDrill" (
    "id" TEXT NOT NULL,
    "drillDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT NOT NULL,
    "backupJobId" TEXT,
    "backupName" TEXT NOT NULL,
    "backupSizeMb" DOUBLE PRECISION,
    "result" TEXT NOT NULL DEFAULT 'PASS',
    "durationSec" INTEGER,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestoreDrill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL DEFAULT 'JOURNAL',
    "amount" DOUBLE PRECISION NOT NULL,
    "account" TEXT NOT NULL DEFAULT 'Main',
    "particulars" TEXT NOT NULL,
    "voucherDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VoucherStatus" NOT NULL DEFAULT 'PENDING_CHECK',
    "enteredBy" TEXT NOT NULL,
    "checkedBy" TEXT,
    "checkedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "postedToTreasury" BOOLEAN NOT NULL DEFAULT false,
    "sourceAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FixedAssetCategory" NOT NULL DEFAULT 'MACHINERY',
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "salvageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL DEFAULT 60,
    "method" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "accumulatedDepreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bookValue" DOUBLE PRECISION NOT NULL,
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciationEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookedBy" TEXT NOT NULL,
    "voucherId" TEXT,

    CONSTRAINT "AssetDepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstReconRun" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "label" TEXT,
    "rows" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "followUps" JSONB NOT NULL,
    "status" "GstReconStatus" NOT NULL DEFAULT 'OPEN',
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstReconRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "programNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "trainer" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "passingScore" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "status" "TrainingStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAttendance" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "status" "TrainingAttendanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "checkedAt" TIMESTAMP(3),
    "checkedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grievance" (
    "id" TEXT NOT NULL,
    "grievanceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stage" "GrievanceStage" NOT NULL DEFAULT 'RAISED',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "investigatedAt" TIMESTAMP(3),
    "investigatedBy" TEXT,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grievance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stage" "DisciplinaryStage" NOT NULL DEFAULT 'NOTICE',
    "noticeIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hearingDate" TIMESTAMP(3),
    "hearingHeldAt" TIMESTAMP(3),
    "decision" "DisciplinaryDecision",
    "decisionNote" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "gstin" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "licenseNumber" TEXT NOT NULL,
    "licenseValidUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractLabourRecord" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "wagePerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "aadharLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractLabourRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpeIssue" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "PpeCategory" NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PpeIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chemical" (
    "id" TEXT NOT NULL,
    "chemicalNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "casNumber" TEXT,
    "hazards" TEXT NOT NULL,
    "storageLocation" TEXT NOT NULL,
    "quantityOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'L',
    "msdsFilePath" TEXT,
    "msdsReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chemical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "consentNumber" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "boardRef" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HazWasteManifest" (
    "id" TEXT NOT NULL,
    "manifestNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "wasteType" TEXT NOT NULL,
    "category" "HazWasteCategory" NOT NULL DEFAULT 'HAZARDOUS',
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "transporter" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'GENERATED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazWasteManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extinguisher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" "ExtinguisherType" NOT NULL,
    "capacityKg" DOUBLE PRECISION NOT NULL,
    "lastInspected" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extinguisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtinguisherInspection" (
    "id" TEXT NOT NULL,
    "extinguisherId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedBy" TEXT NOT NULL,
    "conditionOk" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtinguisherInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpareKit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpareKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpareKitItem" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "spareId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "SpareKitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneDoc" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "deliveredBy" TEXT,
    "fileRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerScorecard" (
    "id" TEXT NOT NULL,
    "scorecardNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "ppm" DOUBLE PRECISION,
    "otpPct" DOUBLE PRECISION,
    "score" DOUBLE PRECISION,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "ItAssetType" NOT NULL,
    "serialNumber" TEXT,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "raisedById" TEXT,
    "assignedToId" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingScanLog" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "ean" TEXT NOT NULL,
    "operatorId" TEXT,
    "shiftId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "PackagingScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnergyReading_date_key" ON "EnergyReading"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_code_key" ON "Plant"("code");

-- CreateIndex
CREATE INDEX "ProductionLine_plantId_idx" ON "ProductionLine"("plantId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");

-- CreateIndex
CREATE INDEX "Machine_lineId_idx" ON "Machine"("lineId");

-- CreateIndex
CREATE INDEX "Machine_plantId_idx" ON "Machine"("plantId");

-- CreateIndex
CREATE INDEX "TelemetryLog_machineId_idx" ON "TelemetryLog"("machineId");

-- CreateIndex
CREATE INDEX "TelemetryLog_at_idx" ON "TelemetryLog"("at");

-- CreateIndex
CREATE INDEX "TelemetryLog_machineId_at_idx" ON "TelemetryLog"("machineId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_code_key" ON "Operation"("code");

-- CreateIndex
CREATE INDEX "RoutingStep_productId_idx" ON "RoutingStep"("productId");

-- CreateIndex
CREATE INDEX "RoutingStep_operationId_idx" ON "RoutingStep"("operationId");

-- CreateIndex
CREATE INDEX "RoutingStep_machineId_idx" ON "RoutingStep"("machineId");

-- CreateIndex
CREATE INDEX "RoutingStep_specialProcessVendorId_idx" ON "RoutingStep"("specialProcessVendorId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingStep_productId_seq_key" ON "RoutingStep"("productId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_clientName_idx" ON "Project"("clientName");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_status_idx" ON "ProjectMilestone"("status");

-- CreateIndex
CREATE INDEX "ProjectMilestone_dueDate_idx" ON "ProjectMilestone"("dueDate");

-- CreateIndex
CREATE INDEX "MovementLog_workOrderId_idx" ON "MovementLog"("workOrderId");

-- CreateIndex
CREATE INDEX "MovementLog_at_idx" ON "MovementLog"("at");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "ShiftRoster_weekStart_idx" ON "ShiftRoster"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRoster_weekStart_key" ON "ShiftRoster"("weekStart");

-- CreateIndex
CREATE INDEX "RosterEntry_userId_idx" ON "RosterEntry"("userId");

-- CreateIndex
CREATE INDEX "RosterEntry_date_idx" ON "RosterEntry"("date");

-- CreateIndex
CREATE INDEX "RosterEntry_shiftId_idx" ON "RosterEntry"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_rosterId_userId_date_key" ON "RosterEntry"("rosterId", "userId", "date");

-- CreateIndex
CREATE INDEX "Logsheet_machineId_logDate_idx" ON "Logsheet"("machineId", "logDate");

-- CreateIndex
CREATE INDEX "Logsheet_status_idx" ON "Logsheet"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Logsheet_machineId_shiftId_logDate_key" ON "Logsheet"("machineId", "shiftId", "logDate");

-- CreateIndex
CREATE INDEX "PerformanceAppraisal_period_idx" ON "PerformanceAppraisal"("period");

-- CreateIndex
CREATE INDEX "PerformanceAppraisal_userId_idx" ON "PerformanceAppraisal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceAppraisal_userId_period_key" ON "PerformanceAppraisal"("userId", "period");

-- CreateIndex
CREATE INDEX "LoginAttempt_identifier_createdAt_idx" ON "LoginAttempt"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeNumber_key" ON "User"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionAccount_invoiceId_key" ON "CollectionAccount"("invoiceId");

-- CreateIndex
CREATE INDEX "CollectionAccount_collectorId_idx" ON "CollectionAccount"("collectorId");

-- CreateIndex
CREATE INDEX "CollectionAccount_dunningLevel_idx" ON "CollectionAccount"("dunningLevel");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_month_key" ON "PayrollRun"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_woNumber_key" ON "WorkOrder"("woNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_productId_idx" ON "WorkOrder"("productId");

-- CreateIndex
CREATE INDEX "WorkOrder_projectId_idx" ON "WorkOrder"("projectId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_trackingToken_idx" ON "WorkOrder"("trackingToken");

-- CreateIndex
CREATE INDEX "WorkOrder_priority_idx" ON "WorkOrder"("priority");

-- CreateIndex
CREATE INDEX "WorkOrder_plannedStartDate_idx" ON "WorkOrder"("plannedStartDate");

-- CreateIndex
CREATE INDEX "WorkOrder_priority_plannedStartDate_idx" ON "WorkOrder"("priority", "plannedStartDate");

-- CreateIndex
CREATE INDEX "WorkOrder_status_plannedStartDate_idx" ON "WorkOrder"("status", "plannedStartDate");

-- CreateIndex
CREATE INDEX "ProductionLog_workOrderId_idx" ON "ProductionLog"("workOrderId");

-- CreateIndex
CREATE INDEX "ProductionLog_machineId_idx" ON "ProductionLog"("machineId");

-- CreateIndex
CREATE INDEX "ProductionLog_operatorId_idx" ON "ProductionLog"("operatorId");

-- CreateIndex
CREATE INDEX "ProductionLog_shiftId_idx" ON "ProductionLog"("shiftId");

-- CreateIndex
CREATE INDEX "ProductionLog_startTime_idx" ON "ProductionLog"("startTime");

-- CreateIndex
CREATE INDEX "ProductionLog_machineId_startTime_idx" ON "ProductionLog"("machineId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "DowntimeReason_code_key" ON "DowntimeReason"("code");

-- CreateIndex
CREATE INDEX "DowntimeLog_machineId_idx" ON "DowntimeLog"("machineId");

-- CreateIndex
CREATE INDEX "DowntimeLog_workOrderId_idx" ON "DowntimeLog"("workOrderId");

-- CreateIndex
CREATE INDEX "DowntimeLog_reasonId_idx" ON "DowntimeLog"("reasonId");

-- CreateIndex
CREATE INDEX "DowntimeLog_startTime_idx" ON "DowntimeLog"("startTime");

-- CreateIndex
CREATE INDEX "DowntimeLog_machineId_startTime_idx" ON "DowntimeLog"("machineId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "DefectCode_code_key" ON "DefectCode"("code");

-- CreateIndex
CREATE INDEX "QualityMeasurement_machineId_idx" ON "QualityMeasurement"("machineId");

-- CreateIndex
CREATE INDEX "QualityMeasurement_characteristic_idx" ON "QualityMeasurement"("characteristic");

-- CreateIndex
CREATE INDEX "QualityMeasurement_measuredAt_idx" ON "QualityMeasurement"("measuredAt");

-- CreateIndex
CREATE INDEX "QualityInspection_workOrderId_idx" ON "QualityInspection"("workOrderId");

-- CreateIndex
CREATE INDEX "QualityInspection_inspectorId_idx" ON "QualityInspection"("inspectorId");

-- CreateIndex
CREATE INDEX "QualityInspection_defectCodeId_idx" ON "QualityInspection"("defectCodeId");

-- CreateIndex
CREATE INDEX "QualityInspection_calibratedToolId_idx" ON "QualityInspection"("calibratedToolId");

-- CreateIndex
CREATE INDEX "ImprovementProject_status_idx" ON "ImprovementProject"("status");

-- CreateIndex
CREATE INDEX "ImprovementProject_type_idx" ON "ImprovementProject"("type");

-- CreateIndex
CREATE INDEX "ImprovementProject_machineId_idx" ON "ImprovementProject"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "RcaRecord_projectId_key" ON "RcaRecord"("projectId");

-- CreateIndex
CREATE INDEX "ActionItem_projectId_idx" ON "ActionItem"("projectId");

-- CreateIndex
CREATE INDEX "ShiftHandover_shiftId_idx" ON "ShiftHandover"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftHandover_machineId_idx" ON "ShiftHandover"("machineId");

-- CreateIndex
CREATE INDEX "ShiftHandover_date_idx" ON "ShiftHandover"("date");

-- CreateIndex
CREATE INDEX "DpmBlocker_status_idx" ON "DpmBlocker"("status");

-- CreateIndex
CREATE INDEX "AssignmentOverride_operatorId_idx" ON "AssignmentOverride"("operatorId");

-- CreateIndex
CREATE INDEX "AssignmentOverride_workOrderId_idx" ON "AssignmentOverride"("workOrderId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_userId_idx" ON "OvertimeRequest"("userId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_action_at_idx" ON "AuditLog"("action", "at");

-- CreateIndex
CREATE INDEX "AuditLog_action_entityType_at_idx" ON "AuditLog"("action", "entityType", "at");

-- CreateIndex
CREATE UNIQUE INDEX "SopDecision_decisionNumber_key" ON "SopDecision"("decisionNumber");

-- CreateIndex
CREATE INDEX "SopDecision_weekStart_idx" ON "SopDecision"("weekStart");

-- CreateIndex
CREATE INDEX "SopDecision_status_idx" ON "SopDecision"("status");

-- CreateIndex
CREATE INDEX "CapacityWindow_machineId_idx" ON "CapacityWindow"("machineId");

-- CreateIndex
CREATE INDEX "CapacityWindow_from_idx" ON "CapacityWindow"("from");

-- CreateIndex
CREATE UNIQUE INDEX "PriceRevision_revisionNumber_key" ON "PriceRevision"("revisionNumber");

-- CreateIndex
CREATE INDEX "PriceRevision_productId_idx" ON "PriceRevision"("productId");

-- CreateIndex
CREATE INDEX "PriceRevision_status_idx" ON "PriceRevision"("status");

-- CreateIndex
CREATE INDEX "PriceRevision_effectiveDate_idx" ON "PriceRevision"("effectiveDate");

-- CreateIndex
CREATE INDEX "Assignment_machineId_idx" ON "Assignment"("machineId");

-- CreateIndex
CREATE INDEX "Assignment_operatorId_idx" ON "Assignment"("operatorId");

-- CreateIndex
CREATE INDEX "Assignment_shiftId_idx" ON "Assignment"("shiftId");

-- CreateIndex
CREATE INDEX "AttendanceLog_userId_idx" ON "AttendanceLog"("userId");

-- CreateIndex
CREATE INDEX "AttendanceLog_shiftId_idx" ON "AttendanceLog"("shiftId");

-- CreateIndex
CREATE INDEX "AttendanceLog_clockIn_idx" ON "AttendanceLog"("clockIn");

-- CreateIndex
CREATE INDEX "AttendanceLog_userId_clockOut_idx" ON "AttendanceLog"("userId", "clockOut");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_endpointKey_key" ON "AttendanceDevice"("endpointKey");

-- CreateIndex
CREATE INDEX "AttendanceDevice_endpointKey_idx" ON "AttendanceDevice"("endpointKey");

-- CreateIndex
CREATE INDEX "AttendanceDevice_isActive_idx" ON "AttendanceDevice"("isActive");

-- CreateIndex
CREATE INDEX "RoutineStep_role_idx" ON "RoutineStep"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineStep_role_seq_key" ON "RoutineStep"("role", "seq");

-- CreateIndex
CREATE INDEX "RoutineProgress_userId_idx" ON "RoutineProgress"("userId");

-- CreateIndex
CREATE INDEX "RoutineProgress_date_idx" ON "RoutineProgress"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineProgress_userId_date_stepId_key" ON "RoutineProgress"("userId", "date", "stepId");

-- CreateIndex
CREATE INDEX "FiveSItem_category_seq_idx" ON "FiveSItem"("category", "seq");

-- CreateIndex
CREATE INDEX "FiveSAudit_area_idx" ON "FiveSAudit"("area");

-- CreateIndex
CREATE INDEX "FiveSAudit_date_idx" ON "FiveSAudit"("date");

-- CreateIndex
CREATE INDEX "FiveSAuditScore_auditId_idx" ON "FiveSAuditScore"("auditId");

-- CreateIndex
CREATE INDEX "FiveSAuditScore_itemId_idx" ON "FiveSAuditScore"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "FiveSAuditScore_auditId_itemId_key" ON "FiveSAuditScore"("auditId", "itemId");

-- CreateIndex
CREATE INDEX "ShiftCount_machineId_idx" ON "ShiftCount"("machineId");

-- CreateIndex
CREATE INDEX "ShiftCount_fromShiftId_idx" ON "ShiftCount"("fromShiftId");

-- CreateIndex
CREATE INDEX "ShiftCount_status_idx" ON "ShiftCount"("status");

-- CreateIndex
CREATE INDEX "ShiftCount_at_idx" ON "ShiftCount"("at");

-- CreateIndex
CREATE INDEX "ScrapQuarantine_workOrderId_idx" ON "ScrapQuarantine"("workOrderId");

-- CreateIndex
CREATE INDEX "ScrapQuarantine_status_idx" ON "ScrapQuarantine"("status");

-- CreateIndex
CREATE INDEX "ScrapQuarantine_createdAt_idx" ON "ScrapQuarantine"("createdAt");

-- CreateIndex
CREATE INDEX "ReworkOrder_quarantineId_idx" ON "ReworkOrder"("quarantineId");

-- CreateIndex
CREATE INDEX "ReworkOrder_targetMachineId_idx" ON "ReworkOrder"("targetMachineId");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_toolCode_key" ON "Tool"("toolCode");

-- CreateIndex
CREATE INDEX "Tool_toolCode_idx" ON "Tool"("toolCode");

-- CreateIndex
CREATE INDEX "Tool_status_idx" ON "Tool"("status");

-- CreateIndex
CREATE INDEX "Idea_status_idx" ON "Idea"("status");

-- CreateIndex
CREATE INDEX "SafetyIncident_type_idx" ON "SafetyIncident"("type");

-- CreateIndex
CREATE INDEX "SafetyIncident_status_idx" ON "SafetyIncident"("status");

-- CreateIndex
CREATE INDEX "SafetyIncident_severity_idx" ON "SafetyIncident"("severity");

-- CreateIndex
CREATE INDEX "SafetyAudit_machineId_idx" ON "SafetyAudit"("machineId");

-- CreateIndex
CREATE INDEX "Certification_userId_idx" ON "Certification"("userId");

-- CreateIndex
CREATE INDEX "Certification_machineId_idx" ON "Certification"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_userId_machineId_key" ON "Certification"("userId", "machineId");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_sku_key" ON "RawMaterial"("sku");

-- CreateIndex
CREATE INDEX "RawMaterial_sku_idx" ON "RawMaterial"("sku");

-- CreateIndex
CREATE INDEX "RawMaterial_isActive_idx" ON "RawMaterial"("isActive");

-- CreateIndex
CREATE INDEX "RawMaterial_supplierId_idx" ON "RawMaterial"("supplierId");

-- CreateIndex
CREATE INDEX "RawMaterial_plantId_idx" ON "RawMaterial"("plantId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_rawMaterialId_idx" ON "InventoryTransaction"("rawMaterialId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_idx" ON "InventoryTransaction"("type");

-- CreateIndex
CREATE INDEX "InventoryTransaction_workOrderId_idx" ON "InventoryTransaction"("workOrderId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_at_idx" ON "InventoryTransaction"("at");

-- CreateIndex
CREATE INDEX "InventoryTransaction_rawMaterialId_type_idx" ON "InventoryTransaction"("rawMaterialId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_rawMaterialId_idx" ON "PurchaseOrder"("rawMaterialId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_approvalStatus_idx" ON "PurchaseOrder"("approvalStatus");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BinLocation_warehouse_idx" ON "BinLocation"("warehouse");

-- CreateIndex
CREATE INDEX "BinLocation_zone_idx" ON "BinLocation"("zone");

-- CreateIndex
CREATE INDEX "BinLocation_rawMaterialId_idx" ON "BinLocation"("rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "WriteOffRequest_requestNumber_key" ON "WriteOffRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "WriteOffRequest_status_idx" ON "WriteOffRequest"("status");

-- CreateIndex
CREATE INDEX "WriteOffRequest_rawMaterialId_idx" ON "WriteOffRequest"("rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparativeStatement_statementNumber_key" ON "ComparativeStatement"("statementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ComparativeStatement_awardedQuoteId_key" ON "ComparativeStatement"("awardedQuoteId");

-- CreateIndex
CREATE INDEX "ComparativeStatement_status_idx" ON "ComparativeStatement"("status");

-- CreateIndex
CREATE INDEX "ComparativeStatement_rawMaterialId_idx" ON "ComparativeStatement"("rawMaterialId");

-- CreateIndex
CREATE INDEX "ComparativeQuote_statementId_idx" ON "ComparativeQuote"("statementId");

-- CreateIndex
CREATE INDEX "ComparativeQuote_supplierId_idx" ON "ComparativeQuote"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RateContract_contractNumber_key" ON "RateContract"("contractNumber");

-- CreateIndex
CREATE INDEX "RateContract_rawMaterialId_idx" ON "RateContract"("rawMaterialId");

-- CreateIndex
CREATE INDEX "RateContract_supplierId_idx" ON "RateContract"("supplierId");

-- CreateIndex
CREATE INDEX "RateContract_status_idx" ON "RateContract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FreightDispatch_dispatchNumber_key" ON "FreightDispatch"("dispatchNumber");

-- CreateIndex
CREATE INDEX "FreightDispatch_vendorId_idx" ON "FreightDispatch"("vendorId");

-- CreateIndex
CREATE INDEX "FreightDispatch_status_idx" ON "FreightDispatch"("status");

-- CreateIndex
CREATE INDEX "FreightDispatch_promisedDate_idx" ON "FreightDispatch"("promisedDate");

-- CreateIndex
CREATE INDEX "BomLine_productId_idx" ON "BomLine"("productId");

-- CreateIndex
CREATE INDEX "BomLine_rawMaterialId_idx" ON "BomLine"("rawMaterialId");

-- CreateIndex
CREATE INDEX "BomLine_createdAt_idx" ON "BomLine"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BomLine_productId_rawMaterialId_key" ON "BomLine"("productId", "rawMaterialId");

-- CreateIndex
CREATE INDEX "Document_productId_idx" ON "Document"("productId");

-- CreateIndex
CREATE INDEX "Document_operationId_idx" ON "Document"("operationId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_uploadedAt_idx" ON "Document"("uploadedAt");

-- CreateIndex
CREATE INDEX "MaintenanceJob_machineId_idx" ON "MaintenanceJob"("machineId");

-- CreateIndex
CREATE INDEX "MaintenanceJob_status_idx" ON "MaintenanceJob"("status");

-- CreateIndex
CREATE INDEX "MaintenanceJob_openedAt_idx" ON "MaintenanceJob"("openedAt");

-- CreateIndex
CREATE INDEX "PMRule_machineId_idx" ON "PMRule"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTool_code_key" ON "MaintenanceTool"("code");

-- CreateIndex
CREATE INDEX "MaintenanceTool_machineId_idx" ON "MaintenanceTool"("machineId");

-- CreateIndex
CREATE INDEX "MaintenanceTool_code_idx" ON "MaintenanceTool"("code");

-- CreateIndex
CREATE INDEX "MaintenanceTool_lifeStatus_idx" ON "MaintenanceTool"("lifeStatus");

-- CreateIndex
CREATE INDEX "ToolLifeLog_toolId_idx" ON "ToolLifeLog"("toolId");

-- CreateIndex
CREATE INDEX "ToolLifeLog_action_idx" ON "ToolLifeLog"("action");

-- CreateIndex
CREATE INDEX "ToolLifeLog_at_idx" ON "ToolLifeLog"("at");

-- CreateIndex
CREATE INDEX "LeanObservation_category_idx" ON "LeanObservation"("category");

-- CreateIndex
CREATE INDEX "LeanObservation_status_idx" ON "LeanObservation"("status");

-- CreateIndex
CREATE INDEX "LeanObservation_observedAt_idx" ON "LeanObservation"("observedAt");

-- CreateIndex
CREATE INDEX "Override_entityType_entityId_idx" ON "Override"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Override_entityType_entityId_field_key" ON "Override"("entityType", "entityId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quoteNumber_key" ON "Quotation"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_customerName_idx" ON "Quotation"("customerName");

-- CreateIndex
CREATE INDEX "Quotation_createdAt_idx" ON "Quotation"("createdAt");

-- CreateIndex
CREATE INDEX "Quotation_status_createdAt_idx" ON "Quotation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "QuotationLine_quotationId_idx" ON "QuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationLine_productId_idx" ON "QuotationLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchRecord_challanNumber_key" ON "DispatchRecord"("challanNumber");

-- CreateIndex
CREATE INDEX "DispatchRecord_workOrderId_idx" ON "DispatchRecord"("workOrderId");

-- CreateIndex
CREATE INDEX "DispatchRecord_challanNumber_idx" ON "DispatchRecord"("challanNumber");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPayment_purchaseOrderId_idx" ON "SupplierPayment"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_dispatchRecordId_key" ON "Invoice"("dispatchRecordId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_customerName_idx" ON "Invoice"("customerName");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_dispatchRecordId_idx" ON "Invoice"("dispatchRecordId");

-- CreateIndex
CREATE INDEX "AnalystQuery_userId_idx" ON "AnalystQuery"("userId");

-- CreateIndex
CREATE INDEX "AnalystQuery_at_idx" ON "AnalystQuery"("at");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "JobRequisition_status_idx" ON "JobRequisition"("status");

-- CreateIndex
CREATE INDEX "JobRequisition_department_idx" ON "JobRequisition"("department");

-- CreateIndex
CREATE INDEX "Candidate_requisitionId_idx" ON "Candidate"("requisitionId");

-- CreateIndex
CREATE INDEX "Candidate_stage_idx" ON "Candidate"("stage");

-- CreateIndex
CREATE INDEX "Interview_candidateId_idx" ON "Interview"("candidateId");

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");

-- CreateIndex
CREATE INDEX "OnboardingTask_candidateId_idx" ON "OnboardingTask"("candidateId");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_fromDate_toDate_idx" ON "LeaveRequest"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerComplaint_complaintNumber_key" ON "CustomerComplaint"("complaintNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_serialNo_key" ON "SerialUnit"("serialNo");

-- CreateIndex
CREATE INDEX "SerialUnit_workOrderId_idx" ON "SerialUnit"("workOrderId");

-- CreateIndex
CREATE INDEX "SerialUnit_productId_idx" ON "SerialUnit"("productId");

-- CreateIndex
CREATE INDEX "SerialUnit_status_idx" ON "SerialUnit"("status");

-- CreateIndex
CREATE INDEX "SerialEvent_serialUnitId_idx" ON "SerialEvent"("serialUnitId");

-- CreateIndex
CREATE INDEX "SerialEvent_type_idx" ON "SerialEvent"("type");

-- CreateIndex
CREATE INDEX "SerialEvent_at_idx" ON "SerialEvent"("at");

-- CreateIndex
CREATE INDEX "QCParameter_productId_idx" ON "QCParameter"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FaiReport_faiNumber_key" ON "FaiReport"("faiNumber");

-- CreateIndex
CREATE INDEX "FaiReport_workOrderId_idx" ON "FaiReport"("workOrderId");

-- CreateIndex
CREATE INDEX "FaiReport_serialUnitId_idx" ON "FaiReport"("serialUnitId");

-- CreateIndex
CREATE INDEX "FaiReport_productId_idx" ON "FaiReport"("productId");

-- CreateIndex
CREATE INDEX "FaiReport_status_idx" ON "FaiReport"("status");

-- CreateIndex
CREATE INDEX "FaiCharacteristic_faiReportId_idx" ON "FaiCharacteristic"("faiReportId");

-- CreateIndex
CREATE UNIQUE INDEX "NcrReport_ncrNumber_key" ON "NcrReport"("ncrNumber");

-- CreateIndex
CREATE UNIQUE INDEX "NcrReport_quarantineId_key" ON "NcrReport"("quarantineId");

-- CreateIndex
CREATE UNIQUE INDEX "NcrReport_grnId_key" ON "NcrReport"("grnId");

-- CreateIndex
CREATE INDEX "NcrReport_status_idx" ON "NcrReport"("status");

-- CreateIndex
CREATE INDEX "NcrReport_workOrderId_idx" ON "NcrReport"("workOrderId");

-- CreateIndex
CREATE INDEX "NcrReport_serialUnitId_idx" ON "NcrReport"("serialUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCert_inventoryTransactionId_key" ON "MaterialCert"("inventoryTransactionId");

-- CreateIndex
CREATE INDEX "MaterialCert_rawMaterialId_idx" ON "MaterialCert"("rawMaterialId");

-- CreateIndex
CREATE INDEX "MaterialCert_heatNumber_idx" ON "MaterialCert"("heatNumber");

-- CreateIndex
CREATE INDEX "MaterialCert_expiresAt_idx" ON "MaterialCert"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalibratedTool_serialNumber_key" ON "CalibratedTool"("serialNumber");

-- CreateIndex
CREATE INDEX "CalibratedTool_status_idx" ON "CalibratedTool"("status");

-- CreateIndex
CREATE INDEX "CalibratedTool_expiresAt_idx" ON "CalibratedTool"("expiresAt");

-- CreateIndex
CREATE INDEX "CalibratedTool_location_idx" ON "CalibratedTool"("location");

-- CreateIndex
CREATE INDEX "CalibratedTool_lifecycle_idx" ON "CalibratedTool"("lifecycle");

-- CreateIndex
CREATE INDEX "InstrumentIssue_calibratedToolId_idx" ON "InstrumentIssue"("calibratedToolId");

-- CreateIndex
CREATE INDEX "InstrumentIssue_issuedAt_idx" ON "InstrumentIssue"("issuedAt");

-- CreateIndex
CREATE INDEX "InstrumentIssue_returnedAt_idx" ON "InstrumentIssue"("returnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialProcessVendor_name_key" ON "SpecialProcessVendor"("name");

-- CreateIndex
CREATE INDEX "SpecialProcessVendor_status_idx" ON "SpecialProcessVendor"("status");

-- CreateIndex
CREATE INDEX "SpecialProcessVendor_processType_idx" ON "SpecialProcessVendor"("processType");

-- CreateIndex
CREATE INDEX "SpecialProcessVendor_expiresAt_idx" ON "SpecialProcessVendor"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractChallan_challanNumber_key" ON "SubcontractChallan"("challanNumber");

-- CreateIndex
CREATE INDEX "SubcontractChallan_workOrderId_idx" ON "SubcontractChallan"("workOrderId");

-- CreateIndex
CREATE INDEX "SubcontractChallan_status_idx" ON "SubcontractChallan"("status");

-- CreateIndex
CREATE INDEX "SubcontractChallan_challanNumber_idx" ON "SubcontractChallan"("challanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DataPackage_packageNumber_key" ON "DataPackage"("packageNumber");

-- CreateIndex
CREATE INDEX "DataPackage_workOrderId_idx" ON "DataPackage"("workOrderId");

-- CreateIndex
CREATE INDEX "DataPackage_packageNumber_idx" ON "DataPackage"("packageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Eco_ecoNumber_key" ON "Eco"("ecoNumber");

-- CreateIndex
CREATE INDEX "EcoItem_ecoId_idx" ON "EcoItem"("ecoId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCampaign_campaignNumber_key" ON "TestCampaign"("campaignNumber");

-- CreateIndex
CREATE INDEX "TestCampaign_workOrderId_idx" ON "TestCampaign"("workOrderId");

-- CreateIndex
CREATE INDEX "TestRecord_campaignId_idx" ON "TestRecord"("campaignId");

-- CreateIndex
CREATE INDEX "StatutoryContribution_month_idx" ON "StatutoryContribution"("month");

-- CreateIndex
CREATE INDEX "StatutoryContribution_employeeCode_idx" ON "StatutoryContribution"("employeeCode");

-- CreateIndex
CREATE INDEX "HealthCheckRecord_checkDate_idx" ON "HealthCheckRecord"("checkDate");

-- CreateIndex
CREATE INDEX "EnvironmentalRecord_recordType_idx" ON "EnvironmentalRecord"("recordType");

-- CreateIndex
CREATE INDEX "EnvironmentalRecord_complianceStatus_idx" ON "EnvironmentalRecord"("complianceStatus");

-- CreateIndex
CREATE INDEX "FireDrillRecord_drillDate_idx" ON "FireDrillRecord"("drillDate");

-- CreateIndex
CREATE UNIQUE INDEX "EximShipment_shipmentNumber_key" ON "EximShipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "EximShipment_shipmentNumber_idx" ON "EximShipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "EximShipment_shipmentDate_idx" ON "EximShipment"("shipmentDate");

-- CreateIndex
CREATE INDEX "InvestorUpdate_quarter_idx" ON "InvestorUpdate"("quarter");

-- CreateIndex
CREATE INDEX "BudgetLine_fiscalYear_idx" ON "BudgetLine"("fiscalYear");

-- CreateIndex
CREATE INDEX "BudgetLine_department_idx" ON "BudgetLine"("department");

-- CreateIndex
CREATE INDEX "TreasuryTransaction_date_idx" ON "TreasuryTransaction"("date");

-- CreateIndex
CREATE INDEX "UtilityReading_utilityType_idx" ON "UtilityReading"("utilityType");

-- CreateIndex
CREATE INDEX "UtilityReading_readAt_idx" ON "UtilityReading"("readAt");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_sku_key" ON "SparePart"("sku");

-- CreateIndex
CREATE INDEX "SparePart_sku_idx" ON "SparePart"("sku");

-- CreateIndex
CREATE INDEX "SparePart_machineCode_idx" ON "SparePart"("machineCode");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_customerName_idx" ON "Contract"("customerName");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "InfrastructureAsset_assetType_idx" ON "InfrastructureAsset"("assetType");

-- CreateIndex
CREATE INDEX "InfrastructureAsset_status_idx" ON "InfrastructureAsset"("status");

-- CreateIndex
CREATE INDEX "BackupJob_startedAt_idx" ON "BackupJob"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QmsAudit_auditNumber_key" ON "QmsAudit"("auditNumber");

-- CreateIndex
CREATE INDEX "QmsAudit_status_idx" ON "QmsAudit"("status");

-- CreateIndex
CREATE INDEX "QmsAudit_standard_idx" ON "QmsAudit"("standard");

-- CreateIndex
CREATE INDEX "QmsAuditFinding_auditId_idx" ON "QmsAuditFinding"("auditId");

-- CreateIndex
CREATE INDEX "QmsAuditFinding_status_idx" ON "QmsAuditFinding"("status");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_employeeCode_key" ON "SalaryStructure"("employeeCode");

-- CreateIndex
CREATE INDEX "SalaryStructure_employeeCode_idx" ON "SalaryStructure"("employeeCode");

-- CreateIndex
CREATE INDEX "Payslip_month_idx" ON "Payslip"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_salaryStructureId_month_key" ON "Payslip"("salaryStructureId", "month");

-- CreateIndex
CREATE INDEX "BankStatementEntry_matchedTreasuryId_idx" ON "BankStatementEntry"("matchedTreasuryId");

-- CreateIndex
CREATE INDEX "BankStatementEntry_uploadBatch_idx" ON "BankStatementEntry"("uploadBatch");

-- CreateIndex
CREATE INDEX "ComplianceDigestLog_generatedAt_idx" ON "ComplianceDigestLog"("generatedAt");

-- CreateIndex
CREATE INDEX "NotificationRead_userId_idx" ON "NotificationRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_userId_notificationId_key" ON "NotificationRead"("userId", "notificationId");

-- CreateIndex
CREATE INDEX "SupplierScorecard_period_idx" ON "SupplierScorecard"("period");

-- CreateIndex
CREATE INDEX "SupplierScorecard_supplierName_idx" ON "SupplierScorecard"("supplierName");

-- CreateIndex
CREATE INDEX "TimeStudy_productSku_idx" ON "TimeStudy"("productSku");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_code_key" ON "Fixture"("code");

-- CreateIndex
CREATE INDEX "Fixture_productId_idx" ON "Fixture"("productId");

-- CreateIndex
CREATE INDEX "Fixture_status_idx" ON "Fixture"("status");

-- CreateIndex
CREATE INDEX "DrawingTransmittal_documentId_idx" ON "DrawingTransmittal"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingTransmittal_documentId_revision_key" ON "DrawingTransmittal"("documentId", "revision");

-- CreateIndex
CREATE INDEX "Escalation_status_idx" ON "Escalation"("status");

-- CreateIndex
CREATE INDEX "Escalation_sourceType_idx" ON "Escalation"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "MrmMeeting_meetingNumber_key" ON "MrmMeeting"("meetingNumber");

-- CreateIndex
CREATE INDEX "MrmMeeting_status_idx" ON "MrmMeeting"("status");

-- CreateIndex
CREATE INDEX "MrmMeeting_date_idx" ON "MrmMeeting"("date");

-- CreateIndex
CREATE INDEX "MrmActionItem_meetingId_idx" ON "MrmActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "MrmActionItem_status_idx" ON "MrmActionItem"("status");

-- CreateIndex
CREATE INDEX "QualityObjective_period_idx" ON "QualityObjective"("period");

-- CreateIndex
CREATE INDEX "QualityObjective_kpiType_idx" ON "QualityObjective"("kpiType");

-- CreateIndex
CREATE UNIQUE INDEX "EightDReport_reportNumber_key" ON "EightDReport"("reportNumber");

-- CreateIndex
CREATE INDEX "EightDReport_status_idx" ON "EightDReport"("status");

-- CreateIndex
CREATE INDEX "EightDReport_ncrId_idx" ON "EightDReport"("ncrId");

-- CreateIndex
CREATE INDEX "EightDReport_productId_idx" ON "EightDReport"("productId");

-- CreateIndex
CREATE INDEX "CapaAction_reportId_idx" ON "CapaAction"("reportId");

-- CreateIndex
CREATE INDEX "CapaAction_status_idx" ON "CapaAction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PpapSubmission_ppapNumber_key" ON "PpapSubmission"("ppapNumber");

-- CreateIndex
CREATE INDEX "PpapSubmission_productId_idx" ON "PpapSubmission"("productId");

-- CreateIndex
CREATE INDEX "PpapSubmission_status_idx" ON "PpapSubmission"("status");

-- CreateIndex
CREATE INDEX "PpapElement_ppapId_idx" ON "PpapElement"("ppapId");

-- CreateIndex
CREATE UNIQUE INDEX "PpapElement_ppapId_elementNo_key" ON "PpapElement"("ppapId", "elementNo");

-- CreateIndex
CREATE UNIQUE INDEX "ControlPlan_planNumber_key" ON "ControlPlan"("planNumber");

-- CreateIndex
CREATE INDEX "ControlPlan_productId_idx" ON "ControlPlan"("productId");

-- CreateIndex
CREATE INDEX "ControlPlan_status_idx" ON "ControlPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_reqNumber_key" ON "PurchaseRequisition"("reqNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_status_idx" ON "PurchaseRequisition"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_assignedToId_idx" ON "PurchaseRequisition"("assignedToId");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_urgency_idx" ON "PurchaseRequisition"("urgency");

-- CreateIndex
CREATE INDEX "PoFollowUpLog_requisitionId_idx" ON "PoFollowUpLog"("requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCountSession_sessionNumber_key" ON "CycleCountSession"("sessionNumber");

-- CreateIndex
CREATE INDEX "CycleCountSession_status_idx" ON "CycleCountSession"("status");

-- CreateIndex
CREATE INDEX "CycleCountSession_abcClass_idx" ON "CycleCountSession"("abcClass");

-- CreateIndex
CREATE INDEX "CycleCountLine_sessionId_idx" ON "CycleCountLine"("sessionId");

-- CreateIndex
CREATE INDEX "CycleCountLine_rawMaterialId_idx" ON "CycleCountLine"("rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialIssueSlip_issueNumber_key" ON "MaterialIssueSlip"("issueNumber");

-- CreateIndex
CREATE INDEX "MaterialIssueSlip_workOrderId_idx" ON "MaterialIssueSlip"("workOrderId");

-- CreateIndex
CREATE INDEX "MaterialIssueSlip_rawMaterialId_idx" ON "MaterialIssueSlip"("rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "CalLabRequisition_reqNumber_key" ON "CalLabRequisition"("reqNumber");

-- CreateIndex
CREATE INDEX "CalLabRequisition_status_idx" ON "CalLabRequisition"("status");

-- CreateIndex
CREATE INDEX "CalLabRequisition_vendorId_idx" ON "CalLabRequisition"("vendorId");

-- CreateIndex
CREATE INDEX "CalLabVendorRating_period_idx" ON "CalLabVendorRating"("period");

-- CreateIndex
CREATE UNIQUE INDEX "CalLabVendorRating_vendorId_period_key" ON "CalLabVendorRating"("vendorId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "IpccChecklistRun_runNumber_key" ON "IpccChecklistRun"("runNumber");

-- CreateIndex
CREATE INDEX "IpccChecklistRun_workOrderId_idx" ON "IpccChecklistRun"("workOrderId");

-- CreateIndex
CREATE INDEX "IpccChecklistRun_machineId_idx" ON "IpccChecklistRun"("machineId");

-- CreateIndex
CREATE INDEX "IpccChecklistRun_status_idx" ON "IpccChecklistRun"("status");

-- CreateIndex
CREATE INDEX "IpccCheckResult_runId_idx" ON "IpccCheckResult"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_grnNumber_key" ON "GoodsReceiptNote"("grnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_ncrId_key" ON "GoodsReceiptNote"("ncrId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_poId_idx" ON "GoodsReceiptNote"("poId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_supplierId_idx" ON "GoodsReceiptNote"("supplierId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_rawMaterialId_idx" ON "GoodsReceiptNote"("rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "AqlPlan_materialClass_key" ON "AqlPlan"("materialClass");

-- CreateIndex
CREATE UNIQUE INDEX "FqcChecklist_workOrderId_key" ON "FqcChecklist"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "QmsDocument_docNumber_key" ON "QmsDocument"("docNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key" ON "SupplierInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_grnId_key" ON "SupplierInvoice"("grnId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_poId_idx" ON "SupplierInvoice"("poId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_status_idx" ON "SupplierInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GageRnrStudy_studyNumber_key" ON "GageRnrStudy"("studyNumber");

-- CreateIndex
CREATE INDEX "GageRnrStudy_toolId_idx" ON "GageRnrStudy"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "PermitToWork_permitNo_key" ON "PermitToWork"("permitNo");

-- CreateIndex
CREATE INDEX "PermitToWork_maintenanceJobId_idx" ON "PermitToWork"("maintenanceJobId");

-- CreateIndex
CREATE INDEX "PermitToWork_status_idx" ON "PermitToWork"("status");

-- CreateIndex
CREATE INDEX "PermitToWork_validUntil_idx" ON "PermitToWork"("validUntil");

-- CreateIndex
CREATE INDEX "AccessReviewCycle_status_idx" ON "AccessReviewCycle"("status");

-- CreateIndex
CREATE INDEX "AccessReviewCycle_dueDate_idx" ON "AccessReviewCycle"("dueDate");

-- CreateIndex
CREATE INDEX "AccessCertification_cycleId_idx" ON "AccessCertification"("cycleId");

-- CreateIndex
CREATE INDEX "AccessCertification_userId_idx" ON "AccessCertification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCertification_cycleId_userId_key" ON "AccessCertification"("cycleId", "userId");

-- CreateIndex
CREATE INDEX "RestoreDrill_drillDate_idx" ON "RestoreDrill"("drillDate");

-- CreateIndex
CREATE INDEX "RestoreDrill_result_idx" ON "RestoreDrill"("result");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherNumber_key" ON "Voucher"("voucherNumber");

-- CreateIndex
CREATE INDEX "Voucher_status_idx" ON "Voucher"("status");

-- CreateIndex
CREATE INDEX "Voucher_voucherDate_idx" ON "Voucher"("voucherDate");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetCode_key" ON "FixedAsset"("assetCode");

-- CreateIndex
CREATE INDEX "FixedAsset_status_idx" ON "FixedAsset"("status");

-- CreateIndex
CREATE INDEX "FixedAsset_category_idx" ON "FixedAsset"("category");

-- CreateIndex
CREATE INDEX "AssetDepreciationEntry_period_idx" ON "AssetDepreciationEntry"("period");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationEntry_assetId_period_key" ON "AssetDepreciationEntry"("assetId", "period");

-- CreateIndex
CREATE INDEX "GstReconRun_period_idx" ON "GstReconRun"("period");

-- CreateIndex
CREATE INDEX "GstReconRun_status_idx" ON "GstReconRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgram_programNumber_key" ON "TrainingProgram"("programNumber");

-- CreateIndex
CREATE INDEX "TrainingProgram_status_idx" ON "TrainingProgram"("status");

-- CreateIndex
CREATE INDEX "TrainingProgram_scheduledDate_idx" ON "TrainingProgram"("scheduledDate");

-- CreateIndex
CREATE INDEX "TrainingAttendance_userId_idx" ON "TrainingAttendance"("userId");

-- CreateIndex
CREATE INDEX "TrainingAttendance_status_idx" ON "TrainingAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAttendance_programId_userId_key" ON "TrainingAttendance"("programId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Grievance_grievanceNumber_key" ON "Grievance"("grievanceNumber");

-- CreateIndex
CREATE INDEX "Grievance_stage_idx" ON "Grievance"("stage");

-- CreateIndex
CREATE INDEX "Grievance_userId_idx" ON "Grievance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaryCase_caseNumber_key" ON "DisciplinaryCase"("caseNumber");

-- CreateIndex
CREATE INDEX "DisciplinaryCase_stage_idx" ON "DisciplinaryCase"("stage");

-- CreateIndex
CREATE INDEX "DisciplinaryCase_userId_idx" ON "DisciplinaryCase"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_code_key" ON "Contractor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_licenseNumber_key" ON "Contractor"("licenseNumber");

-- CreateIndex
CREATE INDEX "Contractor_licenseValidUntil_idx" ON "Contractor"("licenseValidUntil");

-- CreateIndex
CREATE INDEX "ContractLabourRecord_contractorId_idx" ON "ContractLabourRecord"("contractorId");

-- CreateIndex
CREATE INDEX "ContractLabourRecord_isActive_idx" ON "ContractLabourRecord"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PpeIssue_issueNumber_key" ON "PpeIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "PpeIssue_userId_idx" ON "PpeIssue"("userId");

-- CreateIndex
CREATE INDEX "PpeIssue_category_idx" ON "PpeIssue"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Chemical_chemicalNumber_key" ON "Chemical"("chemicalNumber");

-- CreateIndex
CREATE INDEX "Chemical_name_idx" ON "Chemical"("name");

-- CreateIndex
CREATE INDEX "Chemical_storageLocation_idx" ON "Chemical"("storageLocation");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_consentNumber_key" ON "Consent"("consentNumber");

-- CreateIndex
CREATE INDEX "Consent_type_idx" ON "Consent"("type");

-- CreateIndex
CREATE INDEX "Consent_validUntil_idx" ON "Consent"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "HazWasteManifest_manifestNumber_key" ON "HazWasteManifest"("manifestNumber");

-- CreateIndex
CREATE INDEX "HazWasteManifest_date_idx" ON "HazWasteManifest"("date");

-- CreateIndex
CREATE INDEX "HazWasteManifest_status_idx" ON "HazWasteManifest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Extinguisher_code_key" ON "Extinguisher"("code");

-- CreateIndex
CREATE INDEX "Extinguisher_location_idx" ON "Extinguisher"("location");

-- CreateIndex
CREATE INDEX "ExtinguisherInspection_month_idx" ON "ExtinguisherInspection"("month");

-- CreateIndex
CREATE UNIQUE INDEX "ExtinguisherInspection_extinguisherId_month_key" ON "ExtinguisherInspection"("extinguisherId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SpareKit_name_key" ON "SpareKit"("name");

-- CreateIndex
CREATE INDEX "SpareKit_name_idx" ON "SpareKit"("name");

-- CreateIndex
CREATE INDEX "SpareKitItem_spareId_idx" ON "SpareKitItem"("spareId");

-- CreateIndex
CREATE UNIQUE INDEX "SpareKitItem_kitId_spareId_key" ON "SpareKitItem"("kitId", "spareId");

-- CreateIndex
CREATE INDEX "MilestoneDoc_milestoneId_idx" ON "MilestoneDoc"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerScorecard_scorecardNumber_key" ON "CustomerScorecard"("scorecardNumber");

-- CreateIndex
CREATE INDEX "CustomerScorecard_customerName_idx" ON "CustomerScorecard"("customerName");

-- CreateIndex
CREATE INDEX "CustomerScorecard_period_idx" ON "CustomerScorecard"("period");

-- CreateIndex
CREATE UNIQUE INDEX "ItAsset_assetCode_key" ON "ItAsset"("assetCode");

-- CreateIndex
CREATE INDEX "ItAsset_assetType_idx" ON "ItAsset"("assetType");

-- CreateIndex
CREATE INDEX "ItAsset_status_idx" ON "ItAsset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ItTicket_ticketNumber_key" ON "ItTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "ItTicket_status_idx" ON "ItTicket"("status");

-- CreateIndex
CREATE INDEX "ItTicket_priority_idx" ON "ItTicket"("priority");

-- CreateIndex
CREATE INDEX "ItTicket_slaDueAt_idx" ON "ItTicket"("slaDueAt");

-- CreateIndex
CREATE INDEX "PackagingScanLog_workOrderId_timestamp_idx" ON "PackagingScanLog"("workOrderId", "timestamp");

-- CreateIndex
CREATE INDEX "PackagingScanLog_timestamp_idx" ON "PackagingScanLog"("timestamp");

-- AddForeignKey
ALTER TABLE "ProductionLine" ADD CONSTRAINT "ProductionLine_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryLog" ADD CONSTRAINT "TelemetryLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_specialProcessVendorId_fkey" FOREIGN KEY ("specialProcessVendorId") REFERENCES "SpecialProcessVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "ShiftRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logsheet" ADD CONSTRAINT "Logsheet_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logsheet" ADD CONSTRAINT "Logsheet_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logsheet" ADD CONSTRAINT "Logsheet_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceAppraisal" ADD CONSTRAINT "PerformanceAppraisal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_homePlantId_fkey" FOREIGN KEY ("homePlantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAccount" ADD CONSTRAINT "CollectionAccount_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAccount" ADD CONSTRAINT "CollectionAccount_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeLog" ADD CONSTRAINT "DowntimeLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeLog" ADD CONSTRAINT "DowntimeLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeLog" ADD CONSTRAINT "DowntimeLog_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "DowntimeReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeLog" ADD CONSTRAINT "DowntimeLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityMeasurement" ADD CONSTRAINT "QualityMeasurement_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_defectCodeId_fkey" FOREIGN KEY ("defectCodeId") REFERENCES "DefectCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_calibratedToolId_fkey" FOREIGN KEY ("calibratedToolId") REFERENCES "CalibratedTool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementProject" ADD CONSTRAINT "ImprovementProject_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RcaRecord" ADD CONSTRAINT "RcaRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImprovementProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImprovementProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DpmBlocker" ADD CONSTRAINT "DpmBlocker_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityWindow" ADD CONSTRAINT "CapacityWindow_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRevision" ADD CONSTRAINT "PriceRevision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineProgress" ADD CONSTRAINT "RoutineProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineProgress" ADD CONSTRAINT "RoutineProgress_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "RoutineStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveSAuditScore" ADD CONSTRAINT "FiveSAuditScore_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "FiveSAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveSAuditScore" ADD CONSTRAINT "FiveSAuditScore_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FiveSItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCount" ADD CONSTRAINT "ShiftCount_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCount" ADD CONSTRAINT "ShiftCount_fromShiftId_fkey" FOREIGN KEY ("fromShiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCount" ADD CONSTRAINT "ShiftCount_toShiftId_fkey" FOREIGN KEY ("toShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCount" ADD CONSTRAINT "ShiftCount_outgoingUserId_fkey" FOREIGN KEY ("outgoingUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCount" ADD CONSTRAINT "ShiftCount_incomingUserId_fkey" FOREIGN KEY ("incomingUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapQuarantine" ADD CONSTRAINT "ScrapQuarantine_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkOrder" ADD CONSTRAINT "ReworkOrder_quarantineId_fkey" FOREIGN KEY ("quarantineId") REFERENCES "ScrapQuarantine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkOrder" ADD CONSTRAINT "ReworkOrder_targetMachineId_fkey" FOREIGN KEY ("targetMachineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_assignedMachineId_fkey" FOREIGN KEY ("assignedMachineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAudit" ADD CONSTRAINT "SafetyAudit_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinLocation" ADD CONSTRAINT "BinLocation_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteOffRequest" ADD CONSTRAINT "WriteOffRequest_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_awardedQuoteId_fkey" FOREIGN KEY ("awardedQuoteId") REFERENCES "ComparativeQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeQuote" ADD CONSTRAINT "ComparativeQuote_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "ComparativeStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeQuote" ADD CONSTRAINT "ComparativeQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateContract" ADD CONSTRAINT "RateContract_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateContract" ADD CONSTRAINT "RateContract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightDispatch" ADD CONSTRAINT "FreightDispatch_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "FreightVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceJob" ADD CONSTRAINT "MaintenanceJob_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceJob" ADD CONSTRAINT "MaintenanceJob_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "SpareKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PMRule" ADD CONSTRAINT "PMRule_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PMRule" ADD CONSTRAINT "PMRule_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "SpareKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTool" ADD CONSTRAINT "MaintenanceTool_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolLifeLog" ADD CONSTRAINT "ToolLifeLog_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "MaintenanceTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchRecord" ADD CONSTRAINT "DispatchRecord_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dispatchRecordId_fkey" FOREIGN KEY ("dispatchRecordId") REFERENCES "DispatchRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "JobRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialEvent" ADD CONSTRAINT "SerialEvent_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QCParameter" ADD CONSTRAINT "QCParameter_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaiReport" ADD CONSTRAINT "FaiReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaiReport" ADD CONSTRAINT "FaiReport_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaiReport" ADD CONSTRAINT "FaiReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaiCharacteristic" ADD CONSTRAINT "FaiCharacteristic_faiReportId_fkey" FOREIGN KEY ("faiReportId") REFERENCES "FaiReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_quarantineId_fkey" FOREIGN KEY ("quarantineId") REFERENCES "ScrapQuarantine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_defectCodeId_fkey" FOREIGN KEY ("defectCodeId") REFERENCES "DefectCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NcrReport" ADD CONSTRAINT "NcrReport_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCert" ADD CONSTRAINT "MaterialCert_inventoryTransactionId_fkey" FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCert" ADD CONSTRAINT "MaterialCert_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCert" ADD CONSTRAINT "MaterialCert_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldPointSignoff" ADD CONSTRAINT "HoldPointSignoff_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldPointSignoff" ADD CONSTRAINT "HoldPointSignoff_routingStepId_fkey" FOREIGN KEY ("routingStepId") REFERENCES "RoutingStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldPointSignoff" ADD CONSTRAINT "HoldPointSignoff_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentIssue" ADD CONSTRAINT "InstrumentIssue_calibratedToolId_fkey" FOREIGN KEY ("calibratedToolId") REFERENCES "CalibratedTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractChallan" ADD CONSTRAINT "SubcontractChallan_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataPackage" ADD CONSTRAINT "DataPackage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcoItem" ADD CONSTRAINT "EcoItem_ecoId_fkey" FOREIGN KEY ("ecoId") REFERENCES "Eco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCampaign" ADD CONSTRAINT "TestCampaign_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRecord" ADD CONSTRAINT "TestRecord_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QmsAuditFinding" ADD CONSTRAINT "QmsAuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "QmsAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QmsAuditFinding" ADD CONSTRAINT "QmsAuditFinding_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NcrReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementEntry" ADD CONSTRAINT "BankStatementEntry_matchedTreasuryId_fkey" FOREIGN KEY ("matchedTreasuryId") REFERENCES "TreasuryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingTransmittal" ADD CONSTRAINT "DrawingTransmittal_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MrmActionItem" ADD CONSTRAINT "MrmActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MrmMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EightDReport" ADD CONSTRAINT "EightDReport_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NcrReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EightDReport" ADD CONSTRAINT "EightDReport_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "CustomerComplaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EightDReport" ADD CONSTRAINT "EightDReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EightDReport" ADD CONSTRAINT "EightDReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EightDReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpapSubmission" ADD CONSTRAINT "PpapSubmission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpapElement" ADD CONSTRAINT "PpapElement_ppapId_fkey" FOREIGN KEY ("ppapId") REFERENCES "PpapSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlPlan" ADD CONSTRAINT "ControlPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoFollowUpLog" ADD CONSTRAINT "PoFollowUpLog_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CycleCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountLine" ADD CONSTRAINT "CycleCountLine_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueSlip" ADD CONSTRAINT "MaterialIssueSlip_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueSlip" ADD CONSTRAINT "MaterialIssueSlip_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalLabRequisition" ADD CONSTRAINT "CalLabRequisition_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalLabVendorRating" ADD CONSTRAINT "CalLabVendorRating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpccChecklistRun" ADD CONSTRAINT "IpccChecklistRun_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpccChecklistRun" ADD CONSTRAINT "IpccChecklistRun_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpccChecklistRun" ADD CONSTRAINT "IpccChecklistRun_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpccChecklistRun" ADD CONSTRAINT "IpccChecklistRun_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NcrReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpccCheckResult" ADD CONSTRAINT "IpccCheckResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IpccChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FqcChecklist" ADD CONSTRAINT "FqcChecklist_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GageRnrStudy" ADD CONSTRAINT "GageRnrStudy_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "CalibratedTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_maintenanceJobId_fkey" FOREIGN KEY ("maintenanceJobId") REFERENCES "MaintenanceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCertification" ADD CONSTRAINT "AccessCertification_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AccessReviewCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCertification" ADD CONSTRAINT "AccessCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreDrill" ADD CONSTRAINT "RestoreDrill_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "BackupJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationEntry" ADD CONSTRAINT "AssetDepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationEntry" ADD CONSTRAINT "AssetDepreciationEntry_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractLabourRecord" ADD CONSTRAINT "ContractLabourRecord_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtinguisherInspection" ADD CONSTRAINT "ExtinguisherInspection_extinguisherId_fkey" FOREIGN KEY ("extinguisherId") REFERENCES "Extinguisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareKitItem" ADD CONSTRAINT "SpareKitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "SpareKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareKitItem" ADD CONSTRAINT "SpareKitItem_spareId_fkey" FOREIGN KEY ("spareId") REFERENCES "SparePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDoc" ADD CONSTRAINT "MilestoneDoc_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItAsset" ADD CONSTRAINT "ItAsset_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItTicket" ADD CONSTRAINT "ItTicket_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItTicket" ADD CONSTRAINT "ItTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingScanLog" ADD CONSTRAINT "PackagingScanLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingScanLog" ADD CONSTRAINT "PackagingScanLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingScanLog" ADD CONSTRAINT "PackagingScanLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

