# Cycle 10 — Reports, Digest & Print Center (C10)

**Branch:** `v2` · **Date:** 2026-09-05 · **Status:** COMPLETE
**Spec anchor:** DEPTH_03 F1 (Executive & Cross-Department) / F12 (System & Security) · kilo roadmap C10
**Primary risks:** print fidelity, overnight SLA breach detection, mathematical OEE correctness, paise-exact financial registers

## Scope

Typed-core rebuild of the Executive Morning Digest, Operational Registers, and Physical Shopfloor Traveler engines on the C1 org spine, following v2 law (pure engines DB-free → `reportsTx` adapter → zod routes; in-tx audits; no casts; fixed-point paise).

### In scope
1. **Morning Digest Pure Engine (`src/lib/reports/digest.ts`)**:
   - Plant timezone aware (`plantTz` / IST UTC+05:30) midnight-pinned calculations.
   - OEE availability, performance, quality, and overall math with target thresholds.
   - Plant-level and machine-level aggregations and rankings (best / worst).
   - Overnight anomaly & breach detector:
     - Complaint SLA aging (ACK overdue > 24h, 8D CAPA overdue > 10d)
     - Machine downtime > 60m or OEE < target
     - Raw material low-stock alerts (< minStock)
     - Critical/High safety incidents open
2. **Registers Pure Engine (`src/lib/reports/registers.ts`)**:
   - **Production Register**: WO, machine, shift aggregates; good, scrap, rework, efficiency %.
   - **Stock Valuation Register**: Inventory on hand, reorder flags, integer paise valuation (`currentStock * unitCostPaise`).
   - **Job Profitability Register**: Revenue, direct material, direct labor, machine overhead, scrap cost, gross profit in paise, margin %, and status (`PROFITABLE`, `BREAKEVEN`, `UNPROFITABLE`).
   - **Supplier Scorecard Register**: PO count, on-time delivery rate (OTD %), quality acceptance rate.
   - **Sales & GST Register**: Invoices, taxable value, CGST, SGST, IGST, total paise, paid amount, balance due.
3. **Physical Job Traveler Pure Engine (`src/lib/reports/printTraveler.ts`)**:
   - High-fidelity physical shopfloor traveler data structure:
     - Header: WO, SKU, Part Name, Rev, Lot Size, Due Date, Customer, QR payload.
     - Routing Steps: sequence, operation name, machine station, setup/cycle time.
     - Quality Gates: AS9102 FAI required badge (G-1) and Hold Point flags (G-2).
     - Material Traceability: lot/heat number, spec, mill cert requirement.
     - Inspection Characteristics: ballooned dimensions table.
     - Tamper-evident SHA-256 verification hash.
4. **Typed Transaction Adapter (`src/lib/reports/reportsTx.ts`)**:
   - `getMorningDigestTx`
   - `getProductionRegisterTx`
   - `getStockValuationRegisterTx`
   - `getJobProfitabilityRegisterTx`
   - `getJobTravelerPrintDataTx` (with in-tx `AuditLog` `EXPORT_TRAVELER`)
5. **API Routes (`/api/v2/reports/*`)**:
   - `/api/v2/reports/digest`
   - `/api/v2/reports/production`
   - `/api/v2/reports/stock-valuation`
   - `/api/v2/reports/job-profitability`
   - `/api/v2/reports/traveler/[id]`

### Out of scope (documented deferrals)
- Interactive client PDF export widgets (v2 client UI cycle).
- Email dispatch cron background workers (Cycle 13).

## Deliverables
- Engines: `src/lib/reports/digest.ts`, `src/lib/reports/registers.ts`, `src/lib/reports/printTraveler.ts` (pure, Result-typed, DB-free).
- Adapter: `src/lib/reports/reportsTx.ts` ($transaction + audit + strictly typed).
- Routes: `/api/v2/reports/{digest,production,stock-valuation,job-profitability,traveler/[id]}`.
- Tests: `tests/reportDigest.test.ts`, `tests/reportRegisters.test.ts`, `tests/reportPrint.test.ts`.
- Smoke: `scripts/v2-smoke-reports.mjs` → `npm run test:c10-10`.

## Definition of Done
TDD-green → tsc clean → zero `as any` → real-DB smoke green on `mfgmax_v2_test` → MEMORY counts synced → documentation updated → single C10 gate commit on `v2`.
