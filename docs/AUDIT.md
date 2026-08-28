# MASTER FIX AUDIT REPORT — Phase 0

Generated: 2026-08-12 | Commit: 7d4e535 (env hygiene)

---

## 0. Verification Battery Results

| Check | Command | Status |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors after fixes) |
| Production Build | `npm run build` | ✅ PASS (199 pages, 0 missing assets) |
| Desktop Tests | `node --test desktop/tests/**/*.test.js` | ✅ PASS (31/31) |
| Build Verify | `node scripts/verify-build.js` | ✅ PASS |
| Lint | `npm run lint` | ⚠️ PRE-EXISTING 2151 `no-explicit-any` errors (dist/ crashes) |

---

## 1. Route Crawl — 199 Pages, 233 API Routes

### Dead Links / 404s
- **0 broken hard-coded targets** — all `href`, `<Link>`, `router.push`, `fetch()` resolve to existing routes.
- **Phantom routes** (claimed in docs/MEMORY, no page, no references): `/ops/oee`, `/ops/downtime`, `/people/downtime`, `/reports/oee`

### Orphan Pages (exist but unreferenced)
| Page | Reachable Via |
|------|---------------|
| `/iot` | Nowhere (zero refs) |
| `/showroom` | Nowhere |
| `/reports/complaints-register` | Nowhere |
| `/reports/leave-register` | Nowhere |
| `/reports/supplier-payables` | Nowhere |
| `/change-password` | Proxy redirect only (forced pwd change) |
| `/track/[token]` | External/public prefix (`src/proxy.ts:24`) |

### Console Logs in Client Components
**155 occurrences** (154 × `console.error`, 1 × `console.log` at `ServiceWorkerRegister.tsx:15`). All inside `"use client"` files. Most are error-path logging — acceptable but should use a proper logger.

### Unused Imports
TypeScript config has `strict: true` but **no `noUnusedLocals`/`noUnusedParameters`**. Machine scan found 199 candidates across 86 files (mostly `lucide-react` icons). 21 manually confirmed (e.g., `AppShell.tsx:4 useState`, `commercial/desk/page.tsx:2 cookies`, `landing/page.tsx:7 useAnimation`, etc.).

---

## 2. Light-Theme Stragglers (outside print contexts)

| File | Issue | Fix Needed |
|------|-------|------------|
| `src/app/fai/page.tsx:68` | `default: return "bg-white/10 text-slate-300"` | Use designTokens slate variant |
| `src/app/fai/page.tsx:97` | `<thead className="bg-white/5">` | → `bg-slate-800/60` |
| `src/app/fai/page.tsx:109` | `hover:bg-white/5` | → `hover:bg-white/5` (OK) but remove light default |
| `src/app/reports/capacity/page.tsx:35` | `bg-slate-800/60` with `print:bg-white` | OK — print intentional |
| `src/app/reports/capacity/page.tsx:58,60` | `bg-white/5` in table headers | → `bg-slate-800/60` |
| `src/app/reports/capacity/page.tsx:77` | `let bgClass = "print:bg-white"` | Print OK |
| `src/app/reports/complaints-register/page.tsx:19` | `print:bg-white` on root | Print OK |
| `src/app/reports/complaints-register/page.tsx:57` | `bg-white/5` in table header | → `bg-slate-800/60` |
| `src/app/reports/complaints-register/page.tsx:74` | `hover:bg-white/5` | OK |

**Verdict**: 3 files need dark-theme conversion (FAI page, Capacity report header, Complaints register header). Print overrides are intentional and should stay.

---

## 3. Logic Hygiene Gaps

### 3a. API Mutations Missing Audit Logs
**40 handlers / 34 files** write to DB without `logAudit()`:

| Area | Handlers Missing Audit |
|------|------------------------|
| Admin | `admin/certifications` POST, `admin/certifications/[id]` DELETE |
| Assignments | `assignments` POST + DELETE |
| Attendance | `attendance/clock` POST |
| Billing | `billing/webhook` POST |
| Cost Centers | `cost-centers` POST |
| Downtime | `downtime` POST |
| ECO | `eco` POST, `eco/[id]` PUT, `eco/[id]/items` POST |
| Energy | `energy` POST |
| 5S | `fives/audits` POST, `fives/items` POST |
| Ideas | `ideas` POST + PATCH |
| IoT | `iot/ping` POST |
| Kaizen | `kaizen` POST, `kaizen/[id]` POST |
| Landing | `landing/lead` POST |
| Machines | `machines/[machineId]` PATCH |
| Notifications | `notifications/read` POST |
| R&D | 6 handlers (projects, campaigns, records) |
| Routines | `routines` POST, `routines/progress` POST |
| Safety | `safety` POST + PATCH |
| Scrap | `scrap/disposition` PATCH, `scrap/quarantine` POST |
| Settings | `settings` POST |
| Tools | `tools` POST + PATCH |
| User Prefs | `user/prefs` PUT |

**4 Partial Gaps** (audit exists but branches skip):
- `movement/route.ts` POST — success path not audited
- `reconcile/route.ts` POST — finalize path not audited
- `shift-counts/route.ts` POST — OUTGOING create / INCOMING update not audited
- `handover/route.ts` POST — create branch not audited

### 3b. `adjustmentHistory` — Field on 27 Models, Never Written on 11
| Model | Has Field | Writers Found |
|-------|-----------|---------------|
| Quotation | ✅ | ❌ |
| PriceRevision | ✅ | ❌ |
| ScrapQuarantine | ✅ | ❌ |
| ReworkOrder | ✅ | ❌ |
| Idea | ✅ | ❌ |
| SafetyIncident | ✅ | ❌ |
| Supplier | ✅ | ❌ |
| MovementLog | ✅ | ❌ |
| ShiftHandover | ✅ | ❌ |
| ShiftCount | ✅ | ❌ |
| QualityInspection | ✅ | ❌ |

Writers exist for 16 models via `sourceRecordEdit.ts`, `reconcile`, `cycle-count`, `material-issue`, `permits`, `operator-edit`.

### 3c. Page Permission Gating
- **199 pages total**
- **66** have server-side permission gate (`getUserFromHeaders` + `can()`)
- **105** are server components without explicit gate (data via `/api` which enforces RBAC — defense-in-depth gap)
- **28** pure client components with no server check
- **Real Gap**: `reports/attendance/page.tsx` queries `prisma.attendanceLog` directly with **zero auth**. `reports/ot-register` has unused `can` import.

### 3d. Offline Wrapper Coverage (Terminal/Tablet)
`offlineFetchWrapper` defined at `src/lib/offlineSync.ts:343`. **12 of 22 tablet fetches wrapped**; **6 WRITE paths bypass queue**:
1. `/api/logs/operator-edit` (POST) — `OperatorRecentLogs.tsx:85`
2. `/api/auth/change-password` (POST) — `OperatorTabletView.tsx:271`
3. `/api/operator/assign-override` (POST) — `OperatorTabletView.tsx:451`
4. `/api/routines/progress` (PUT) — `MyRoutineCard.tsx:51`
5. `/api/docs/audit` (POST) — `DrawingLightboxModal.tsx:37`
6. `/api/user/prefs` (PUT) — `LanguageToggle.tsx:47`

sw.js: precaches `/` shell only; navigation fallback serves cached `/` for any route. API GETs network-first with cache fallback.

### 3e. try/catch & Error Shape
- 168 handlers have try/catch; 2 unwrapped (`auth/logout`, `update/apply` — no DB writes)
- Error response shape inconsistent: some `{ error }`, some `{ message }`, some raw Prisma errors

---

## 4. Performance — Serial Waterfalls & Missing Indexes

### 4a. Server-Side Waterfalls (10 parallelizable groups)

| Location | Independent Queries | Current | Fix |
|----------|---------------------|---------|-----|
| `src/lib/data.ts:256-293` (`getStatsData`) | 4 (2 dependent) | Sequential | `Promise.all([prodLogs, downLogs])` |
| `src/lib/data.ts:217-223` (`getMachinesData`) | 2 | Sequential | Fold `getOEERules()` into `Promise.all` |
| `src/lib/leaderboardData.ts:29-64` | 4 | Sequential | Single `Promise.all` |
| `src/lib/digestData.ts:30-47` + `136-137` | 4 + 2 | Sequential | `Promise.all` 30/34; `Promise.all` 42/47; run 136/137 concurrently |
| `src/app/command/page.tsx:348-357` | 3 | Sequential | Merge into Batch 2 |
| `src/app/command/page.tsx:386-390` | 1 conditional | Serial | Fetch unconditionally in Batch 2 |
| `src/lib/costingEngine.ts:64-211` | 5+2 per WO | Sequential | Parallelize; hoist energy query |
| `src/app/supply/vault/page.tsx:20-41` | 3 | Sequential | Single `Promise.all` |
| `src/app/api/inventory/route.ts:12-28` | 2 | Sequential | `Promise.all` |
| `src/lib/capacityEngine.ts:26-61` | 3 | Sequential | Single `Promise.all` |
| `src/app/api/capacity/finite/route.ts:19-33` | 1 + `Promise.all` | Partial | Fold setting into `Promise.all` |

**Worst offender**: `src/app/api/operator/state/route.ts` — **13 sequential queries**, polled every 5s from tablet.

### 4b. Missing Indexes (Prisma Schema)

| Model | Existing `@@index` | Missing | Priority |
|-------|-------------------|---------|----------|
| AuditLog (812) | `[at]` | `action`, `entityType`, `(action, at)` | 🔴 Critical |
| WorkOrder (511) | `[productId]`, `[projectId]`, `[status]`, `[trackingToken]` | `priority`, `plannedStartDate`, `(status, plannedStartDate)` | 🔴 |
| PurchaseOrder (1307) | `[supplierId]`, `[rawMaterialId]`, `[status]`, `[approvalStatus]` | `createdAt`, `(status, createdAt)` | 🟡 |
| Quotation (1659) | `[status]`, `[customerName]` | `createdAt`, `(status, createdAt)` | 🟡 |
| Machine (153) | `[lineId]` | `plantId` | 🟡 |
| RawMaterial (1242) | `[sku]` (unique), `[isActive]`, `[supplierId]` | `plantId` | 🟡 |
| InventoryTransaction (1276) | `[rawMaterialId]`, `[type]`, `[workOrderId]`, `[at]` | `(rawMaterialId, type)` | 🟡 |
| AttendanceLog (935) | `[userId]`, `[shiftId]`, `[clockIn]` | `(userId, clockOut)` | 🟢 Optional |

### 4c. Client-Side Waterfalls
**0 serial fetch chains** — all four heavy client components (`DashboardClient`, `WorkOrdersClientHeader`, `VaultClient`, `CapacityClient`) are single-fetch or pure presentational. Real waterfalls are server-side.

---

## 5. Promised Features — EXISTS / MISSING

| Feature | Verdict | Evidence |
|---------|---------|----------|
| Employee-number login (+legacy fallback) | **EXISTS** | `src/lib/employeeLookup.ts`, `src/app/api/auth/login/route.ts:91` (employeeNumber first, username/email fallback) |
| Tally export | **EXISTS** | `/api/tally/export` (INVOICES/PAYMENTS/PAYABLES/PARTIES/XML_SALES), `TallyExportButtons` component |
| Excel import wizard | **EXISTS** | `/system/import` + `src/lib/importConfig.ts` (Products/Customers/Suppliers/BOMs, `check=1` server re-validation) |
| First-run onboarding wizard | **EXISTS** | `/onboarding` + `src/lib/onboardingSample.ts` (S1-S4, `/api/setup`) |
| Shopfloor interlink wave | **PARTIAL** | M1-M5 modules exist (`/ops/ppc`, `/ops/finite-capacity`, `/ops/tool-room`, `/ops/ie-observations`, `/ops/hourly-andon`). **MISSING**: SETUP/RUN/CHANGEOVER event types (operator actions = START_JOB/LOG_GOOD/LOG_SCRAP/REPORT_DOWNTIME/END_DOWNTIME/COMPLETE_JOB only), **logsheet verification** (no Logsheet model) |
| Role levels MANAGER/WORKER | **EXISTS** | `UserLevel` enum, `level` field on User (default WORKER), `managerGate.ts`, level-aware `HubClient` |
| Tile-first 64px icon rail | **EXISTS** | `src/app/components/layout/Sidebar.tsx` (13 squircle IconTiles, layoutId accent) |
| /projects + /system hubs | **EXISTS** | `projects/page.tsx`, `system/page.tsx` (both render `HubClient` + `SubFunctionGrid` from `departments.ts`) |

---

## 6. Phase Plan Summary

| Phase | Scope | Key Actions |
|-------|-------|-------------|
| **P1 Design** | Fix 3 straggler pages to designTokens; delete stray `console.log`; verify sidebar/hubs/grids | Convert FAI, Capacity, Complaints-register headers to `bg-slate-800/60`; remove `console.log` in `ServiceWorkerRegister` |
| **P2 Logic** | Add audit to 40 handlers + 4 branch gaps; `adjustmentHistory` on 11 never-written models; gate `reports/attendance`; wrap 6 offline writes; standardize `{ error }` shape; `Promise.all` waterfalls; add 8 indexes + `db push`; enable `noUnusedLocals` after cleanup | Highest impact — hardening |
| **P3 Features** | ONLY missing: shopfloor SETUP/RUN/CHANGEOVER event types + logsheet verification (extend `operator/action` — no parallel systems) | Minimal scope |
| **P4 Desktop v1.1** | Logical `pg_dump` backup option (v1 = physical copy), `MFGMAX_START_ON_BOOT` installer checkbox, disk-serial license fingerprint (`licenseOnline.js` exists → add fingerprint), re-run 31/31 tests + rebuild installer | Desktop hardening |
| **P5 Verify** | `tsc` clean, build clean, tests green, zero-404 crawl; **REWRITE MEMORY.md** to EXACTLY match codebase (drop stale: OEE pages, light stragglers, gate-pass model confusion); commit "Ultimate Master Fix"; propose tag `v1.1.0` | Final reconciliation |

---

## Files to Touch (Phase 1-2 Priority)

**Design (P1):**
- `src/app/fai/page.tsx` — status badge, table header
- `src/app/reports/capacity/page.tsx` — table header
- `src/app/reports/complaints-register/page.tsx` — table header
- `src/app/components/layout/ServiceWorkerRegister.tsx` — remove `console.log`

**Logic (P2):**
- 34 API route files (add `logAudit` imports + calls)
- 11 models (add `adjustmentHistory` writes in edit paths)
- `src/app/reports/attendance/page.tsx` (add server gate)
- 6 terminal files (wrap writes in `offlineFetchWrapper`)
- 10 waterfall locations (add `Promise.all`)
- `prisma/schema.prisma` (add 8 indexes) → `prisma db push`
- `tsconfig.json` (add `noUnusedLocals`, `noUnusedParameters`)

**Features (P3):**
- `src/app/api/operator/action/route.ts` (add SETUP/RUN/CHANGEOVER cases)
- `prisma/schema.prisma` (add Logsheet model + events)

**Desktop (P4):**
- `desktop/lib/embeddedDb.js` (add `pg_dump` option)
- `desktop/electron/main.js` (add checkbox wiring)
- `desktop/lib/licenseOnline.js` (add disk serial)

**Reconcile (P5):**
- `MEMORY.md` (full rewrite)
- `docs/AUDIT.md` (this file)