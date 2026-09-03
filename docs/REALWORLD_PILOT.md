# Real-World Pilot — Do-It-All Runbook (Offline Desktop)

This doc makes the 3 manual checks runnable by anyone on the shop PC. No code change — just one-time ops.

## 1. Kiosk LAN Lock (optional, 2 min)
If your shop WiFi is **isolated** (only your tablets + server PC), skip — leave `MFGMAX_KIOSK_TOKEN` unset and kiosks stay open (`src/proxy.ts:73`).

If WiFi is **shared** and you want only your tablets to post `LOG_GOOD`/`LOG_SCRAP`:

**a) Generate token (already done for you):**
```
35feef8352e77a0b4a82a50d80b4f85a627d9ec4c129ea02
```
**b) Set on the server PC** (the PC that runs the `.exe`):
- Create `C:\Users\<you>\MfgMaxData\kiosk-token.txt` containing that hex, OR set Windows env `MFGMAX_KIOSK_TOKEN=35feef8...129ea02` before launching the exe.
- Restart the exe — `desktop/launcher.js:158` forwards it to `src/proxy.ts:73` (`x-kiosk-token` gate).

**c) Set on each tablet** (kiosk browser):
- In the kiosk tablet's bookmark/home-screen URL, add `?kioskToken=35feef8...129ea02` once, OR have IT add header `x-kiosk-token: 35feef8...` in the tablet's wrapper app.
- Test: from a phone **not** on the allowlist, `curl http://<server>:3000/api/operator/action -X POST` → `401 Kiosk token required`. From tablet → `200`.

To **unlock** again, delete the env/txt and restart.

## 2. Physical Restore Drill (5 min, proves you can recover)

**Goal:** Prove `desktop/lib/vault` keep-30 + `physicalRestore` actually brings the DB back.

**Steps on a TEST PC (not the live floor PC):**
1. On live PC: tray → `Backup Now` → note file `backups/pgdata-2026-...` (or `.dump`) + size.
2. Copy that single file to a USB stick.
3. On test PC: install the same `.exe`, launch, let it finish `seedIfEmpty`, then close.
4. On test PC: tray → `Restore…` → pick the USB file → `Restore` → confirm `Restore complete. Server restarted.` → open `http://127.0.0.1:3000/system/health` → `server running / db running` + same `workOrder` count as live.
5. If `health` shows `crashed`, check `MfgMaxData/logs/postgres.log` tail (the launcher already logs it).

That one drill covers both `logical pg_dump -Fc` and `physical pgdata-*` paths (`desktop/launcher.js:614`).

## 3. Walk 2 Operators — Terminal / Andon (10 min on the floor)

**Kit:** 1 tablet (gloves on), 1 wall TV/browser on `http://<server>:3000/ops/andon`.

**Script (do it twice, once per operator):**
1. Tablet: `/terminal` → enter `employeeNumber` (e.g., `operator`/`1234`) → pick `Machine: CNC Milling Bay 01` → `START_JOB` on a `PLANNED` WO → TV should flip that machine to `RUNNING` (green).
2. Tablet: `+1 Good` ×3 → TV `goodQuantity` should +3 within 5s (`/api/andon` poll).
3. Tablet: `+1 Scrap` with `defectCode: DEFECT_GENERIC` → TV `scrapQuantity` +1, `ScrapQuarantine` appears in `/mrb` as `PENDING`.
4. Tablet: `REPORT_DOWNTIME` → pick `Mechanical` → TV that machine `DOWN` (red) + timer starts.
5. Tablet: `END_DOWNTIME` → TV back to `RUNNING`.
6. Back on office PC: `/reconcile` — `Shift WIP` `inCount`/`outCount` should match what the two tablets did; `AGREED` vs `DISPUTED` logic (`src/app/api/shift-counts`) must be `AGREED`.

If all 6 match, the `offlineSync.ts:290` queue + `IdempotencyKey` + `SequenceCounter` + `plantScope` are live.

## 4. Ledger & Governance Walk — finance close, integrity sweep, risks (10 min at the office PC)

**Kit:** 1 office PC, finance + system logins.

**Script:**
1. `/finance/gl-backfill` → `Run integrity check` → expect "Books check out — N entries balance" (the daily 02:30 desktop sweep writes the same scan to `GlIntegrityRun`).
2. `/finance/hub` → the integrity banner should be absent; `Receivables`/`Bank Balance` figures match treasury (+/₹) and are paise-exact (₹1,234.56 style, never rounded off).
3. `/system/risk-register` → the 3 seeded risks show CRITICAL/HIGH/MEDIUM with owners; RK-2026-001 shows `REVIEW OVERDUE` → hit `Review` → overdue clears, next review +90d.
4. Register a real risk (e.g. "Single-person dependency for NC programming", L3×I2): sliders show `MEDIUM (6)` live → `Register` → it lands at the top of the list.
5. `/reports/compliance-digest` → `Risk Register` category lists the HIGH/CRITICAL risks and overdue reviews — the same flags auto-populate the MRM agenda (`/quality/mrm`).

If all 5 work, the fixed-point ledger, GL backfill/integrity provenance, and risk-based thinking (ISO 9001 6.1) are live end-to-end.

---

**After these 4, tick `HANDOVER.md` and ship.** No code left — next is just watching `MfgMaxData/logs/postgres.log` and `backup` count during the first real shift.
