# EDITABILITY & CONSTANTS AUDIT

## 1. SOURCE RECORDS EDITABILITY (Layer 1a)
- [x] **ProductionLog**: `goodQuantity`, `scrapQuantity`, `reworkQuantity`, `startTime`, `endTime`. Has `adjustmentHistory` & AuditLog.
- [x] **DowntimeLog**: `startTime`, `endTime`, `durationMinutes`, `reasonId`, `notes`. Has `adjustmentHistory` & AuditLog.
- [x] **AttendanceLog (ShiftAttendance)**: `clockIn`, `clockOut`, `status`. Has `adjustmentHistory` & AuditLog.
- [x] **MovementLog**: `quantity`, `fromStation`, `toStation`. Has `adjustmentHistory` & AuditLog.
- [x] **InventoryTransaction**: `qty`, `unitCost`, `batchNo`, `reference`. Has `adjustmentHistory` & AuditLog.
- [x] **QualityInspection**: `totalInspected`, `passed`, `failed`, `notes`. Has `adjustmentHistory` & AuditLog.
- [x] **MaintenanceJob**: `priority`, `type`, `status`, `rootCause`, `partsUsed`, `costRupees`, `laborHours`. Has `adjustmentHistory` & AuditLog.
- [x] **ShiftHandover**: `productionNotes`, `downtimeNotes`, `safetyNotes`, `nextShiftActions`, `missReason`. Has `adjustmentHistory` & AuditLog.
- [x] **ShiftCount**: `count`. Has `adjustmentHistory` & AuditLog.
- [x] **Tool & MaintenanceTool**: `usedUnits`, `ratedLifeUnits`. Has `adjustmentHistory` & AuditLog.
- [x] **PurchaseOrder**: `qty`, `receivedQty`, `unitCost`, `status`. Has `adjustmentHistory` & AuditLog.
- [x] **WorkOrder**: `plannedQuantity`, `quotedPrice`, `setupTimeMinutes`, `cycleTimeSeconds`. Has `adjustmentHistory` & AuditLog.

## 2. MANUAL OVERRIDES LAYER (Layer 1b)
- [x] **Override Model & API**: `Override(id, entityType, entityId, field, value, note, byName, at)` with unique key `[entityType, entityId, field]` and `/api/overrides` route.
- [x] **Dashboard / Plant KPI Overrides**: OEE, Availability, Performance, Quality overrides with badge & clear action.
- [x] **Machine-Day OEE Overrides**: Machine detail & grid OEE manual override via `OverrideBadgeModal`.
- [x] **Work Order Costing Overrides**: Total job cost & margin % manual override via `WorkOrderFinancialCard`.
- [x] **Operator Efficiency Overrides**: Attendance & efficiency register manual override via `AttendanceClient`.

## 3. SYSTEM CONSTANTS TAB & SETTINGS (Layer 1c)
- [x] **Prisma / Settings helper update**: All plant limits, thresholds, and magic numbers stored in `Setting` key-value table.
- [x] **Admin > "System Constants" Tab**: Complete UI editor for all system limits:
  - OEE Good Threshold (Default: 85%)
  - OEE Warning Threshold (Default: 70%)
  - Plan Gate Threshold (Default: 95%)
  - OT Statutory Limit Hours (Default: 50h)
  - Operator Oops Edit Window (Default: 15 mins)
  - Kiosk Refresh / Countdown Seconds (Default: 30s)
  - Shift WIP Handoff Count Tolerance (Default: 0)
  - Document Upload Max Size Cap (Default: 4 MB)
  - Operator Efficiency Rating Bands (Default: 95/80/65 %)
  - Default PO Reorder Multiplier (Default: 1.2)
