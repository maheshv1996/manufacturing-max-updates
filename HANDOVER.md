# Manufacturing Max — Handover

**Stack:** Next.js 16.3 standalone + Prisma 7.9 + embedded Postgres (`pgbin`) / `file:app.db` fallback, Electron `nsis` (`MfgMaxData/`, `backups/`, `logs/`).

## Run
```bash
npm install
npx prisma db push   # adds SequenceCounter + IdempotencyKey (PR1)
npx prisma db seed
npm run dev          # http://localhost:3000
npm run dist         # → dist/ManufacturingMax-Setup-1.0.0.exe (verify-build + harden-desktop + bytenode)
```
Desktop: `desktop/electron/main.js` → `DesktopApp` (`launcher.js`) handles `SESSION_SECRET` (`MfgMaxData/secrets.json`), `embeddedDb` init, `migrate deploy`, `seedIfEmpty`, `watchdog` (server+db), `scheduleDailyBackup 20:00`, `scheduleIdempotencyPrune 02:15` (`desktop/lib/pruneIdempotency.js` via `pg`/`node:sqlite`, 7-day TTL), `scheduleLedgerIntegrity 02:30` (`desktop/lib/ledgerIntegrity.js` POSTs `/api/finance/gl-integrity` with the control-token Bearer; the proxy admits that one endpoint via `MFGMAX_CONTROL_TOKEN` mirroring the kiosk gate — every other `/api/*` still needs a session).

## Auth / Proxy
`src/proxy.ts:15` public: `/terminal`, `/track`, `/api/auth/*`, `/api/health`, `/api/setup`, `/landing`, `/showroom`, `/ops/andon`. Kiosk APIs (`/api/operator`, `/api/terminal`, `/api/attendance/clock`, `/api/ipcc`, `/api/hold-points`) public but `MFGMAX_KIOSK_TOKEN` gate if set (`x-kiosk-token`). Others require `app_session` JWT (`jose`) + `sessionEpoch` re-check + `permissionForPath` → `can()` (`src/lib/permissions.ts:99` phantom manager heuristic removed — must list `ops.view` etc explicitly). `plantScope.ts:6` now fail-closed (`throw` if no `app_session`).

## Data Integrity (PR1-4 + ledger)
- Money is **integer paise** end-to-end (`src/lib/money.ts` row-mappers): GL (`JournalEntry/JournalLine` debit+credit paise, `totalDebit/totalCredit`), and documents (Invoice, Payment, SupplierInvoice, ExpenseClaim, TreasuryTransaction, BankStatementEntry, Customer.creditLimit, BudgetLine). Rupee contract at every API edge; `Float` columns hold exact integers by convention.
- Ledger provenance: `GlIntegrityRun` records every backfill execution and integrity scan. `src/lib/glBackfill.ts` replays missing docs (invoices/payments/expense/payroll) idempotently; `src/lib/glIntegrity.ts` scans for posted-but-unbalanced entries + unposted docs; `/finance/gl-backfill` workbench + finance-hub banner surface both; the 02:30 desktop sweep keeps the record fresh daily.
- `src/app/api/register/[entity]` maps money models (`MONEY_MODEL_BY_ENTITY`) both ways, GET and POST.

## Data Integrity (PR1-4)
- `src/lib/sequence.ts` `nextSequenceTx` via `SequenceCounter` (no `count()+1` race) used in `purchasing:117`, `grn:203`, `invoices`, `quotations`, `vouchers`, `ncr`.
- `src/lib/idempotency.ts` `IdempotencyKey` (`clientId @unique`) replaces in-memory `Set` in `operator/action:10`, `attendance/clock:5`, `inventory`, `grn`, `purchasing`, `invoices`, `quotations`, `vouchers`. Offline queue (`lib/offlineSync.ts:290` `X-Client-ID`) dedupes correctly over watchdog restarts. Pruned daily `02:15` via launcher + `src/instrumentation.ts:15` when `DESKTOP_MODE`.
- `inventory/route.ts:165` `OUT` now `updateMany where gte` atomic; `grn` + `purchasing RECEIVE` + `operator LOG_GOOD/LOG_SCRAP` + `invoices` + `quotations` + `vouchers` all `$transaction`.
- `costingEngine.ts:194` no longer fabricates `planned*0.25` for `IN_PROGRESS`; `mrpEngine.ts:107` cycle guard `visited Set` + `MAX_BOM_DEPTH 20` + lot truncation note.
- `upload/route.ts:7` no longer `fs.writeFile` to `public/uploads` (read-only on Vercel, lost on dump) → data URI in `Setting.branding.logoUrl` via `prisma.setting.upsert`, `ALLOWED_LOGO_TYPES` + `maxFileUploadMb` + `system.edit` gate.

## Validation / Errors
`src/lib/validate.ts` `parseOr400` + `zod@4.4.3` on `purchasing CREATE_PO`, `invoices`, `quotations`, `vouchers`; 150 POST routes got minimal `typeof body` guard via `scripts/harden-api-routes.mjs` (96 `500` leaks stripped `details: error.message` → `"Internal Server Error"`). Remaining per-field schemas can follow same pattern.

## Pages
`src/app/page.tsx:7` gateway → `onboarding` if `!onboardingComplete`; `onboarding/page.tsx:8` now `force-dynamic` + first-run anonymous allow (`!complete && userCount===0`). 51 server pages added `force-dynamic` (`scripts/add-dynamic.mjs`). `PageHeader` (`src/app/components/shared/PageHeader.tsx:33` `iconTone` map) exemplars: `commercial/quotations amber`, `people/attendance violet`, `quality/fqc emerald` — pattern for remaining 31.

## Verify
`npx tsc --noEmit` (0) → `npm run build` (168) → `npm run test` (50 desktop) → `npx prisma db push` already synced. `LOG_DIR`/`BACKUP_DIR` via `serverEnv()`.

## Next
- ESLint `no-error-message-in-500` to lock `internalError()`
- `vercel.json` cron or keep launcher prune (offline already)
- Per-field `zod` for remaining 150 minimal-guarded POSTs as features land
- Tier-2 org backlog (full analysis in `docs/ORG_GAP_ANALYSIS.md`):
  1. Org chart + RACI + ~10 seeded functional role bundles (PLANT_HEAD,
     DEPT_HEAD, BUYER, STOREKEEPER, ACCOUNTANT, HR_EXEC, EHS_OFFICER,
     IT_ADMIN, AUDITOR, RISK_OWNER) - reuses existing permission keys,
     zero schema change for the bundles; wire `risk.view`/`risk.edit` into
     the risk-register gates.
  2. Exit / offboarding management (notice -> handover -> FnF -> asset
     recovery -> access revocation -> exit interview).
  3. Supplier audits (cadence + findings + CAPA linkage) and CSAT / VOC.
  4. TDS compliance tracker; MOC beyond ECO; policy acknowledgements;
     anonymous whistleblower channel; contract expiry alerts into the
     digest. (Visitor logs, PPE issues and fleet already exist.)
  5. Tier-3 (grep-verified absent, see `docs/ORG_GAP_ANALYSIS.md`):
     credit/debit notes + returns, CSR (customer-specific requirements)
     matrix, skill/competency matrix + SOP sign-off, gratuity provisioning,
     employee loans & advances, petty cash, e-invoice IRN + GSTR-1/3B
     exports, board resolutions + related-party registers, password policy
     enforcement, cheque register, insurance claims, sales quota/commission.
  6. Tier-4 (grep-verified absent): supplier portal/ASN, accident register
     with LTI, POSH/ICC cases, employee credential expiry, litigation
     register, IP register, tender/bid management, BG/LC register, capex
     request (CER) with ROI, product recall/notices. (Announcements,
     haz-waste, write-offs, defect tracking already exist.)
