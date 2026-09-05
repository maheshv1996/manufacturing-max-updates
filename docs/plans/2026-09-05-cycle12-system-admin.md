# Cycle 12 — System, Admin & Config (C12)

**Branch:** `v2` · **Date:** 2026-09-05 · **Status:** COMPLETE
**Spec anchor:** DEPTH_02 §7 (Org-Chart Admin & Hierarchy), DEPTH_03 F12 (Terminology & System Config), DEPTH_03 F13 (Custom Entities & Dynamic Record Validation) · kilo roadmap C12
**Primary risks:** Low-code dynamic schema injection, DAG cycle prevention in organizational hierarchies (Tree of Trust), audit trail completeness across custom record lifecycles.

## Scope

Typed-core implementation of System Administration, Low-Code Custom Entities, Live Org-Chart Hierarchy with DAG Cycle Detection, and Enterprise Terminology/Constants Configuration:
1. **Low-Code Custom Entities & Records (`src/lib/custom/*`)**:
   - Pure validation engine for dynamic JSON records against field definitions (`text`, `number`, `date`, `select`, `boolean`).
   - Strict validation of required fields, allowed options arrays, numeric ranges, and ISO-8601 date formats.
   - Title slugification to unique lowercase identifiers.
   - Single Prisma `$transaction` persistence with in-tx `AuditLog` rows (`CUSTOM_ENTITY_CREATED`, `CUSTOM_ENTITY_UPDATED`, `CUSTOM_RECORD_CREATED`, `CUSTOM_RECORD_UPDATED`, `CUSTOM_RECORD_DELETED`).
2. **Org Reporting Lines & Live Org-Chart Hierarchy (`src/lib/org/*`)**:
   - Pure DAG cycle detection preventing direct loops (A -> B -> A), indirect multi-hop loops (A -> B -> C -> A), and self-reporting (A -> A).
   - Date window resolution (`validFrom`, `validTo`) filtering expired reporting lines.
   - Org hierarchy tree builder combining units, head seats, members, and reporting lines into a clean nested hierarchy.
   - Reporting line termination with immediate active window expiration and in-tx audit logs (`REPORTING_LINE_CREATED`, `REPORTING_LINE_TERMINATED`).
3. **System Terminology & Constants Config (`src/lib/system/*`)**:
   - Terminology customization engine allowing enterprise users to override canonical manufacturing terms (e.g. `work_order` -> `Production Ticket`, `ncr` -> `Defect Incident`) while guaranteeing fallback to default terms.
   - System constants configuration (OEE target percentage, count tolerance, mill cert requirement, max overtime hours, timezone, currency) with in-tx audit logs (`TERMINOLOGY_UPDATED`, `SYSTEM_CONSTANTS_UPDATED`).
4. **API Route Handlers (`src/app/api/v2/*`)**:
   - `GET /api/v2/custom/entities` & `POST /api/v2/custom/entities`
   - `GET /api/v2/custom/entities/[id]` & `PATCH /api/v2/custom/entities/[id]`
   - `GET /api/v2/custom/records` & `POST /api/v2/custom/records`
   - `GET /api/v2/custom/records/[id]`, `PATCH /api/v2/custom/records/[id]`, & `DELETE /api/v2/custom/records/[id]`
   - `GET /api/v2/org/reporting-lines` & `POST /api/v2/org/reporting-lines`
   - `DELETE /api/v2/org/reporting-lines/[id]`
   - `GET /api/v2/org/chart`
   - `GET /api/v2/system/terminology` & `PUT /api/v2/system/terminology`
   - `GET /api/v2/system/constants` & `PUT /api/v2/system/constants`
5. **Test Coverage**:
   - Unit Tests: `tests/customEntityEngine.test.ts`, `tests/orgReportingLineEngine.test.ts`, `tests/systemTerminologyEngine.test.ts` (13/13 PASS).
   - Full Suite: 650/650 PASS across 31 suites.
   - Real-DB Smoke Test: `scripts/v2-smoke-system-admin.mjs` (`npm run test:c12-12`) — 12/12 PASS against PostgreSQL `mfgmax_v2_test`.

## Definition of Done Verification
- **Unit Tests**: 650/650 PASS across 31 suites (13 new C12 tests).
- **TypeScript**: `tsc --noEmit` exited 0 (0 errors).
- **Zero `as any` Casts**: 0 across all files in `src/lib/custom/`, `src/lib/org/reportingLine*`, `src/lib/system/`, and `src/app/api/v2/custom/`, `src/app/api/v2/org/`, `src/app/api/v2/system/`.
- **Real-DB Smoke**: `npm run test:c12-12` — 12/12 PASS on `mfgmax_v2_test`.
- **Census**: 274 pages, 387 API routes, 214 models, 106 enums (verified via `node scripts/verify-counts.mjs`).
